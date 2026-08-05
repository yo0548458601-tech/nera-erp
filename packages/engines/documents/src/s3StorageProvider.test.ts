import { describe, expect, it } from 'vitest';
import {
  createS3StorageProvider,
  headObjectForCertification,
  loadS3StorageProviderConfigFromEnv,
} from './s3StorageProvider';

/**
 * Live storage provider-certification tests (ADR-011 Decision item 12).
 * Requires a real S3-compatible endpoint - SeaweedFS locally/CI (pinned
 * version 4.40, commit 875cd1f67ea25e8965a4f5ba1e6aaf501ba6b6fa, per
 * Decision item 11), AWS S3 in a certification environment. Configured
 * entirely by `DOCUMENT_STORAGE_*` environment variables - see
 * `packages/engines/documents/README.md` for local setup.
 *
 * A fake/mocked provider (see `uploadDocument.test.ts` etc.) cannot catch a
 * real signature/endpoint/path-style mismatch - this suite is what actually
 * proves the `StorageProvider` contract against a real S3-compatible
 * server, per `NERA_ARCHITECTURAL_INVARIANTS.md` §13.7's precedent for
 * Prisma/DB defects, applied here to the other real external dependency
 * this sprint introduces.
 */
describe('S3StorageProvider (requires a real S3-compatible endpoint)', () => {
  const config = loadS3StorageProviderConfigFromEnv();
  const provider = createS3StorageProvider(config);

  it('round-trips upload -> signed URL -> real HTTP GET -> delete -> 404 after delete', async () => {
    const key = `organizations/test-org/documents/${crypto.randomUUID()}.txt`;
    const content = new TextEncoder().encode('P014 live storage certification');

    const uploaded = await provider.upload(key, content, { contentType: 'text/plain' });
    expect(uploaded).toEqual({ key });

    const url = await provider.getSignedUrl(key, 900);
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('P014 live storage certification');

    await provider.delete(key);

    const afterDelete = await fetch(url);
    expect(afterDelete.status).toBe(404);
  });

  it('sets Content-Disposition exactly as provided, never derived by the provider itself (ADR-011 Decision item 15)', async () => {
    const key = `organizations/test-org/documents/${crypto.randomUUID()}.pdf`;
    const contentDisposition = 'attachment; filename="invoice.pdf"';

    await provider.upload(key, new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      contentType: 'application/pdf',
      contentDisposition,
    });

    const metadata = await headObjectForCertification(config, key);
    expect(metadata.contentDisposition).toBe(contentDisposition);
    expect(metadata.contentType).toBe('application/pdf');

    await provider.delete(key);
  });

  it('delete() is idempotent - deleting an already-absent key does not throw (ADR-011 Decision item 5)', async () => {
    const key = `organizations/test-org/documents/${crypto.randomUUID()}-never-uploaded.txt`;
    await expect(provider.delete(key)).resolves.not.toThrow();
  });

  it('a signed URL stops working once its expiration has passed', async () => {
    const key = `organizations/test-org/documents/${crypto.randomUUID()}-expiring.txt`;
    await provider.upload(key, new TextEncoder().encode('expires soon'), {
      contentType: 'text/plain',
    });

    const url = await provider.getSignedUrl(key, 1);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await fetch(url);
    expect(response.status).toBe(403);

    await provider.delete(key);
  });

  it('a signed URL with a responseContentDisposition override serves that exact header; stored metadata is untouched; the object stays private (P014 View/Download)', async () => {
    const key = `organizations/test-org/documents/${crypto.randomUUID()}.pdf`;
    const storedDisposition = 'attachment; filename="stored.pdf"';
    const overrideDisposition = 'inline; filename="view-copy.pdf"';
    let uploaded = false;

    try {
      await provider.upload(key, new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        contentType: 'application/pdf',
        contentDisposition: storedDisposition,
      });
      uploaded = true;

      const viewUrl = await provider.getSignedUrl(key, 60, {
        responseContentDisposition: overrideDisposition,
      });
      const viewResponse = await fetch(viewUrl);
      expect(viewResponse.headers.get('content-disposition')).toBe(overrideDisposition);
      expect(viewResponse.headers.get('content-type')).toBe('application/pdf');

      // The persisted object metadata itself is untouched by the override.
      const metadata = await headObjectForCertification(config, key);
      expect(metadata.contentDisposition).toBe(storedDisposition);

      // A short-lived SigV4 presigned URL, not a public link: its query
      // string carries a signature (SigV4 never embeds the raw secret key
      // itself) and an expiry matching exactly the requested short
      // duration. The full URL is never logged.
      expect(viewUrl).toContain('X-Amz-Expires=60');
      expect(viewUrl).toContain('X-Amz-Signature=');

      // The object is not public: an unsigned request for the same key
      // must be denied with a documented anonymous-access-denial status -
      // not merely "not 200" (a 5xx would not prove privacy). Constructed
      // directly from this test's own configuration; never printed,
      // alongside no endpoint/bucket/key/headers/body/credentials anywhere
      // in this test.
      const unsignedUrl = config.forcePathStyle
        ? `${config.endpoint}/${config.bucket}/${key}`
        : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
      const ACCEPTED_ANONYMOUS_DENIAL_STATUSES = [401, 403, 404];
      const unsignedResponse = await fetch(unsignedUrl);
      expect(ACCEPTED_ANONYMOUS_DENIAL_STATUSES).toContain(unsignedResponse.status);
    } finally {
      if (uploaded) {
        await provider.delete(key);
      }
    }
  });
});

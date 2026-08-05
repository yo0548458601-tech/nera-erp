import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '@nera/core';
import type { OrganizationEngine } from '@nera/organization-engine';
import {
  getDocumentUrl,
  DocumentNotAvailableError,
  DocumentViewModeNotAllowedError,
} from './getDocumentUrl';
import type { DocumentRepositoryDbClient, DocumentRecord } from './persistence/documentRepository';

const CONTROLLED_FILENAME = 'חשבונית ספק אברהם (2).pdf';

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    status: 'available',
    storageKey: 'organizations/org-1/documents/doc-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 1024,
    checksumSha256: 'x'.repeat(64),
    createdByUserId: 'user-1',
    deletedByUserId: null,
    purgedByUserId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    purgedAt: null,
    reconciledAt: null,
    ...overrides,
  };
}

function createFakeGetOrganizationContext(
  record: DocumentRecord | null
): OrganizationEngine['getOrganizationContext'] {
  // Simulates real RLS behavior, not merely getDocumentById's own
  // downstream JS check: a row belonging to a different organization than
  // the context's own organizationId is invisible to the query itself -
  // findUnique returns null, not a record that some later check filters
  // out. context.organizationId is the same value getDocumentUrl's own
  // getOrganizationContext({ organizationId }, ...) call passes through.
  return async (context, work) => {
    const txClient: DocumentRepositoryDbClient = {
      document: {
        create: vi.fn(),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (!record) return null;
          if (where.id !== record.id) return null;
          if (record.organizationId !== context.organizationId) return null;
          return record;
        }),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    return work(txClient as never);
  };
}

function createFakeStorageProvider(): StorageProvider {
  return {
    upload: vi.fn(),
    getSignedUrl: vi.fn(async key => `fake://${key}?signed=1`),
    delete: vi.fn(),
  };
}

function lastResponseContentDisposition(storageProvider: StorageProvider): string {
  const call = (storageProvider.getSignedUrl as ReturnType<typeof vi.fn>).mock.calls[0];
  const options = call[2] as { responseContentDisposition?: string } | undefined;
  return options?.responseContentDisposition ?? '';
}

describe('getDocumentUrl', () => {
  it('returns a signed URL for an available document owned by the requesting organization (default mode: download)', async () => {
    const storageProvider = createFakeStorageProvider();

    const url = await getDocumentUrl(
      'doc-1',
      'org-1',
      storageProvider,
      'download',
      900,
      createFakeGetOrganizationContext(makeRecord())
    );

    expect(url).toBe('fake://organizations/org-1/documents/doc-1?signed=1');
    expect(storageProvider.getSignedUrl).toHaveBeenCalledWith(
      'organizations/org-1/documents/doc-1',
      900,
      { responseContentDisposition: expect.stringMatching(/^attachment;/) }
    );
  });

  it.each(['application/pdf', 'image/jpeg', 'image/png'])(
    'view mode requests inline disposition for %s - the actual signed-URL argument is checked, not merely that the promise resolves',
    async contentType => {
      const storageProvider = createFakeStorageProvider();

      await getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        'view',
        900,
        createFakeGetOrganizationContext(makeRecord({ contentType }))
      );

      const disposition = lastResponseContentDisposition(storageProvider);
      expect(disposition.startsWith('inline;')).toBe(true);
    }
  );

  it.each([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ])('rejects view mode for %s (DOCX/XLSX cannot be viewed inline)', async contentType => {
    const storageProvider = createFakeStorageProvider();

    await expect(
      getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        'view',
        900,
        createFakeGetOrganizationContext(makeRecord({ contentType }))
      )
    ).rejects.toThrow(DocumentViewModeNotAllowedError);
    expect(storageProvider.getSignedUrl).not.toHaveBeenCalled();
  });

  it('download mode is always allowed regardless of content type', async () => {
    const storageProvider = createFakeStorageProvider();
    await expect(
      getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        'download',
        900,
        createFakeGetOrganizationContext(
          makeRecord({
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          })
        )
      )
    ).resolves.toBeDefined();
  });

  describe('Content-Disposition for the controlled Hebrew test filename', () => {
    it('view mode produces an inline, RFC 5987-encoded disposition', async () => {
      const storageProvider = createFakeStorageProvider();

      await getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        'view',
        900,
        createFakeGetOrganizationContext(
          makeRecord({ contentType: 'application/pdf', originalFilename: CONTROLLED_FILENAME })
        )
      );

      const disposition = lastResponseContentDisposition(storageProvider);
      expect(disposition.startsWith('inline;')).toBe(true);
      expect(disposition).not.toMatch(/^attachment;/);
      expect(disposition).toContain("filename*=UTF-8''");
      expect(disposition).toContain('%28');
      expect(disposition).toContain('%29');
      // Correct UTF-8 percent-encoding for the first Hebrew character
      // (ח, U+05D7 -> UTF-8 bytes 0xD7 0x97).
      expect(disposition).toContain('%D7%97');
    });

    it('download mode produces an attachment, RFC 5987-encoded disposition', async () => {
      const storageProvider = createFakeStorageProvider();

      await getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        'download',
        900,
        createFakeGetOrganizationContext(
          makeRecord({ contentType: 'application/pdf', originalFilename: CONTROLLED_FILENAME })
        )
      );

      const disposition = lastResponseContentDisposition(storageProvider);
      expect(disposition.startsWith('attachment;')).toBe(true);
      expect(disposition).not.toMatch(/^inline;/);
      expect(disposition).toContain("filename*=UTF-8''");
      expect(disposition).toContain('%28');
      expect(disposition).toContain('%29');
      expect(disposition).toContain('%D7%97');
    });
  });

  it.each(['view', 'download'] as const)(
    'rejects a document belonging to a different organization - the scoped repository read itself returns null (mode: %s)',
    async mode => {
      const storageProvider = createFakeStorageProvider();
      await expect(
        getDocumentUrl(
          'doc-1',
          'org-1',
          storageProvider,
          mode,
          900,
          createFakeGetOrganizationContext(makeRecord({ organizationId: 'org-2' }))
        )
      ).rejects.toThrow(DocumentNotAvailableError);
      expect(storageProvider.getSignedUrl).not.toHaveBeenCalled();
    }
  );

  it.each(['view', 'download'] as const)(
    'rejects a document that is not yet available (still uploading) (mode: %s)',
    async mode => {
      const storageProvider = createFakeStorageProvider();
      await expect(
        getDocumentUrl(
          'doc-1',
          'org-1',
          storageProvider,
          mode,
          900,
          createFakeGetOrganizationContext(makeRecord({ status: 'uploading' }))
        )
      ).rejects.toThrow(DocumentNotAvailableError);
    }
  );

  it.each(['view', 'download'] as const)('rejects a soft-deleted document (mode: %s)', async mode => {
    const storageProvider = createFakeStorageProvider();
    await expect(
      getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        mode,
        900,
        createFakeGetOrganizationContext(makeRecord({ deletedAt: new Date('2026-01-01') }))
      )
    ).rejects.toThrow(DocumentNotAvailableError);
  });

  it.each(['view', 'download'] as const)('rejects a purged document (mode: %s)', async mode => {
    const storageProvider = createFakeStorageProvider();
    await expect(
      getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        mode,
        900,
        createFakeGetOrganizationContext(
          makeRecord({ deletedAt: new Date('2026-01-01'), purgedAt: new Date('2026-01-02') })
        )
      )
    ).rejects.toThrow(DocumentNotAvailableError);
  });

  it.each(['view', 'download'] as const)('rejects an unknown document id (mode: %s)', async mode => {
    const storageProvider = createFakeStorageProvider();
    await expect(
      getDocumentUrl('missing', 'org-1', storageProvider, mode, 900, createFakeGetOrganizationContext(null))
    ).rejects.toThrow(DocumentNotAvailableError);
  });
});

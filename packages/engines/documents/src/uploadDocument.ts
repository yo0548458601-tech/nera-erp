import { createHash } from 'node:crypto';
import type { StorageProvider } from '@nera/core';
import { createOrganizationEngine, type OrganizationEngine } from '@nera/organization-engine';
import { generateDocumentStorageKey } from './document.js';
import { buildContentDisposition } from './filenameSanitization.js';
import { validateFileUpload } from './fileValidation.js';
import { createDocumentRepository, type DocumentRecord } from './persistence/documentRepository.js';

export type UploadDocumentInput = {
  organizationId: string;
  createdByUserId: string;
  filename: string;
  declaredContentType: string;
  bytes: Uint8Array;
};

export class DocumentUploadRejectedError extends Error {
  constructor(public readonly reason: string) {
    super(`Document upload rejected: ${reason}`);
    this.name = 'DocumentUploadRejectedError';
  }
}

/**
 * Server-proxied upload flow, matching ADR-011 Decision item 4/5 exactly:
 * validate -> compute checksum -> generate key -> create row (status
 * "uploading", own transaction) -> storageProvider.upload() (no DB
 * transaction held across this slow, external call - a deliberate ADR-011
 * requirement) -> on success, mark "available" (own transaction); on
 * failure, mark "failed" and attempt a targeted compensating delete inline
 * (not-found = success; a delete failure leaves the row failed/
 * unreconciled for the reconciliation service to retry later).
 *
 * Permission checking (`checkPermission`) and audit recording happen at the
 * Server Action layer (`apps/web/src/lib/actions/documentActions.ts`), not
 * here - matching the established precedent (`requirePermission`/
 * `recordAudit` are never imported into a Core Engine package; see
 * `packages/engines/entities`'s own dependencies). This function's
 * multi-phase, external-I/O-crossing shape is why the final audit write
 * cannot share literally the same transaction as `markDocumentAvailable`
 * the way a single-step CRUD mutation's audit write does - the caller
 * audits the record this function returns, which reflects the exact final
 * persisted state either way.
 *
 * `getOrganizationContext` is injectable (defaults to the real
 * `@nera/organization-engine` implementation against `appPrisma`) so tests
 * can supply a fake transaction wrapper, matching this repository's own
 * injectable-client convention.
 */
export async function uploadDocument(
  input: UploadDocumentInput,
  storageProvider: StorageProvider,
  getOrganizationContext: OrganizationEngine['getOrganizationContext'] = createOrganizationEngine()
    .getOrganizationContext
): Promise<DocumentRecord> {
  const validation = validateFileUpload({
    filename: input.filename,
    declaredContentType: input.declaredContentType,
    sizeBytes: input.bytes.length,
    bytes: input.bytes,
  });
  if (!validation.ok) {
    throw new DocumentUploadRejectedError(validation.reason);
  }

  const checksumSha256 = createHash('sha256').update(input.bytes).digest('hex');
  const storageKey = generateDocumentStorageKey(input.organizationId);

  const created = await getOrganizationContext({ organizationId: input.organizationId }, tx =>
    createDocumentRepository(tx).createUploadingDocument(input.organizationId, {
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId,
      originalFilename: input.filename,
      contentType: input.declaredContentType,
      fileSizeBytes: input.bytes.length,
      checksumSha256,
      storageKey,
    })
  );

  try {
    await storageProvider.upload(storageKey, input.bytes, {
      contentType: input.declaredContentType,
      contentDisposition: buildContentDisposition(input.filename),
    });
  } catch (uploadError) {
    await getOrganizationContext({ organizationId: input.organizationId }, tx =>
      createDocumentRepository(tx).markDocumentFailed(created.id, input.organizationId)
    );
    try {
      await storageProvider.delete(storageKey);
    } catch {
      // Compensating delete also failed - the row stays failed/unreconciled;
      // the reconciliation service retries the same targeted delete later
      // (ADR-011 Decision item 5).
    }
    throw uploadError instanceof Error
      ? uploadError
      : new Error('uploadDocument: storage upload failed.');
  }

  return getOrganizationContext({ organizationId: input.organizationId }, tx =>
    createDocumentRepository(tx).markDocumentAvailable(created.id, input.organizationId)
  );
}

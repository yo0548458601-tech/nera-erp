import type { StorageProvider } from '@nera/core';
import { createOrganizationEngine, type OrganizationEngine } from '@nera/organization-engine';
import { createDocumentRepository, type DocumentRecord } from './persistence/documentRepository.js';

/**
 * Administrator hard-delete (ADR-013 Decision item C.4): a deliberately
 * separate code path from normal (soft) deletion, not a flag on it. Marks
 * the row purged, then physically removes the storage object after that
 * write commits. `documentRepository.hardDeleteDocument` never performs
 * I/O itself, so composing the physical delete is this function's job,
 * exactly as `uploadDocument.ts` composes its own provider calls around the
 * repository's pure DB methods. Like `uploadDocument`, this crosses an
 * external I/O boundary (the storage delete), so the caller's audit write
 * (`apps/web/src/lib/actions/documentActions.ts`) runs in its own separate
 * transaction after this resolves, not literally the same transaction as
 * the DB purge - see `uploadDocument.ts`'s module doc comment for the same
 * reasoning applied here.
 */
export async function hardDeleteDocument(
  documentId: string,
  organizationId: string,
  purgedByUserId: string,
  storageProvider: StorageProvider,
  getOrganizationContext: OrganizationEngine['getOrganizationContext'] = createOrganizationEngine()
    .getOrganizationContext
): Promise<DocumentRecord> {
  const purged = await getOrganizationContext({ organizationId }, tx =>
    createDocumentRepository(tx).hardDeleteDocument(documentId, organizationId, purgedByUserId)
  );

  await storageProvider.delete(purged.storageKey);

  return purged;
}

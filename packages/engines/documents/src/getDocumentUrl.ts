import type { StorageProvider } from '@nera/core';
import { createOrganizationEngine, type OrganizationEngine } from '@nera/organization-engine';
import { isDocumentAvailable } from './document.js';
import { createDocumentRepository } from './persistence/documentRepository.js';

/** Default signed-download URL expiration (ADR-013 Decision item E). */
export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900;

export class DocumentNotAvailableError extends Error {
  constructor(documentId: string) {
    super(`Document "${documentId}" is not available.`);
    this.name = 'DocumentNotAvailableError';
  }
}

/**
 * Organization-ownership and `available`-status verification (the second
 * and third parts of ADR-011 Decision item 7 / ADR-013 Decision item E's
 * three-part authorization gate). Permission verification (`checkPermission`,
 * the first part of that gate) happens at the Server Action layer before
 * this is called - matching the established `requirePermission` precedent,
 * not embedded in this Core Engine function (see `uploadDocument.ts`'s
 * module doc comment for the same reasoning). No object URL is ever
 * persisted (ADR-011 Decision item 16) - this mints one fresh, per request.
 */
export async function getDocumentUrl(
  documentId: string,
  organizationId: string,
  storageProvider: StorageProvider,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  getOrganizationContext: OrganizationEngine['getOrganizationContext'] = createOrganizationEngine()
    .getOrganizationContext
): Promise<string> {
  const document = await getOrganizationContext({ organizationId }, tx =>
    createDocumentRepository(tx).getDocumentById(documentId, organizationId)
  );

  if (!document || !isDocumentAvailable(document)) {
    throw new DocumentNotAvailableError(documentId);
  }

  return storageProvider.getSignedUrl(document.storageKey, expiresInSeconds);
}

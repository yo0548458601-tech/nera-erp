import type { StorageProvider } from '@nera/core';
import { createOrganizationEngine, type OrganizationEngine } from '@nera/organization-engine';
import { isDocumentAvailable } from './document.js';
import { buildContentDisposition, buildInlineContentDisposition } from './filenameSanitization.js';
import { createDocumentRepository } from './persistence/documentRepository.js';

/** Default signed-download URL expiration (ADR-013 Decision item E). */
export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900;

export type DocumentUrlMode = 'view' | 'download';

/** Browser-viewable-inline allowlist (P014 Owner requirement) - closed, not open-by-default, matching ADR-013 Decision item A's closed-allowlist precedent for uploads. */
const INLINE_VIEWABLE_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export class DocumentNotAvailableError extends Error {
  constructor(documentId: string) {
    super(`Document "${documentId}" is not available.`);
    this.name = 'DocumentNotAvailableError';
  }
}

export class DocumentViewModeNotAllowedError extends Error {
  constructor(documentId: string, contentType: string) {
    super(
      `Document "${documentId}" (${contentType}) cannot be viewed inline - only PDF/JPEG/PNG support view mode.`
    );
    this.name = 'DocumentViewModeNotAllowedError';
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
 *
 * `mode` (P014 Owner requirement) controls the signed URL's response
 * Content-Disposition: "view" requests `inline` (rendered in the
 * application's in-page document preview) and is only allowed for content
 * types a browser can safely render inline; "download" (the default,
 * matching the pre-existing behavior)
 * requests `attachment`. Neither mode changes the object's own persisted
 * metadata or makes it public - both go through the same short-lived S3
 * GetObject signed URL, only overriding the response header the presigned
 * request itself returns.
 */
export async function getDocumentUrl(
  documentId: string,
  organizationId: string,
  storageProvider: StorageProvider,
  mode: DocumentUrlMode = 'download',
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

  if (mode === 'view' && !INLINE_VIEWABLE_CONTENT_TYPES.has(document.contentType)) {
    throw new DocumentViewModeNotAllowedError(documentId, document.contentType);
  }

  const responseContentDisposition =
    mode === 'view'
      ? buildInlineContentDisposition(document.originalFilename)
      : buildContentDisposition(document.originalFilename);

  return storageProvider.getSignedUrl(document.storageKey, expiresInSeconds, {
    responseContentDisposition,
  });
}

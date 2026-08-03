import { randomUUID } from 'node:crypto';

/**
 * Upload lifecycle only (ADR-011 Decision item 5) - independent of the
 * deletion lifecycle (deletedAt/purgedAt below), which is never combined
 * into this status. See schema.prisma's DocumentStatus doc comment for the
 * same rationale on the persisted side.
 */
export type DocumentStatus = 'uploading' | 'available' | 'failed';

/**
 * A stored file's metadata (ADR-011/ADR-013). The Document Engine never
 * interprets file content and never persists a URL - a usable download URL
 * is minted per-request only, via getSignedUrl() (ADR-011 Decision item 16).
 */
export type Document = {
  id: string;
  organizationId: string;
  status: DocumentStatus;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  createdByUserId: string;
  deletedByUserId?: string | null;
  purgedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set immediately on normal delete (ADR-013 Decision item C.1) - the 30-day recovery window starts here. */
  deletedAt?: string | null;
  /** Set once the physical object is actually removed - by the 30-day retention/purge service or by an administrator hard-delete (ADR-013 Decision item C.3-4). Never restorable once set. */
  purgedAt?: string | null;
  /** Set once the reconciliation service has confirmed cleanup for a stuck uploading/failed row (ADR-011 Decision item 5's "marks the row fully resolved" step). */
  reconciledAt?: string | null;
};

/** A generic, module-agnostic link between one Document and one business record (ADR-013 Decision item D). */
export type DocumentLink = {
  id: string;
  organizationId: string;
  documentId: string;
  targetRecordType: string;
  targetRecordId: string;
  linkedByUserId: string;
  createdAt: string;
  /** Soft-delete on unlink (Owner decision, P014 implementation session). */
  deletedAt?: string | null;
  deletedByUserId?: string | null;
};

export type NewDocumentUploadInput = {
  organizationId: string;
  createdByUserId: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  storageKey: string;
};

export type NewDocumentLinkInput = {
  organizationId: string;
  documentId: string;
  targetRecordType: string;
  targetRecordId: string;
  linkedByUserId: string;
};

/**
 * `deletedAt`/`purgedAt` are typed loosely (`unknown`) rather than tied to
 * `Document`'s own `string | null` shape, since both the pure domain type
 * (ISO string) and the persistence `DocumentRecord` type (`Date | null`)
 * must satisfy the same truthiness check without a mismatch.
 */
type DocumentAvailabilityFields = { status: DocumentStatus; deletedAt?: unknown };
type DocumentRestorabilityFields = { deletedAt?: unknown; purgedAt?: unknown };

/** A document is only ever accessible/downloadable/linkable while `available` and not deleted. */
export function isDocumentAvailable(document: DocumentAvailabilityFields): boolean {
  return document.status === 'available' && !document.deletedAt;
}

/** Restorable only within the 30-day window: soft-deleted, but not yet purged (ADR-013 Decision item C.2). */
export function isDocumentRestorable(document: DocumentRestorabilityFields): boolean {
  return Boolean(document.deletedAt) && !document.purgedAt;
}

/**
 * Server-generated object key only - never derived from or containing the
 * original filename (ADR-011 Decision item 6), namespaced by organizationId
 * so tenant isolation on the physical object is defense-in-depth even
 * before any application-layer check runs (ADR-011 Decision item 7).
 */
export function generateDocumentStorageKey(organizationId: string): string {
  if (typeof organizationId !== 'string' || organizationId.trim().length === 0) {
    throw new Error('generateDocumentStorageKey: "organizationId" is required.');
  }
  return `organizations/${organizationId}/documents/${randomUUID()}`;
}

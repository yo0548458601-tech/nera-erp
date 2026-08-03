'use server';

/**
 * Server Actions for the Document Engine (P014 - see docs/ROADMAP.md).
 * Same established sequence as customFieldActions.ts/entityActions.ts:
 * requirePermission -> engine call (its own getOrganizationContext
 * transaction(s)) -> recordAudit -> publish the approved event after
 * commit. `uploadDocument`/`hardDeleteDocument` compose their own
 * multi-phase transactions inside `@nera/document-engine` itself (they
 * cross an external storage-provider I/O boundary, which ADR-011 forbids
 * holding a single DB transaction across) - see those functions' own doc
 * comments for why their audit write runs in a separate transaction from
 * the mutation, unlike the single-transaction shape every other P013-era
 * action uses.
 *
 * A minimal verification UI (`app/(app)/operations/documents/page.tsx`)
 * exercises these actions end-to-end in a real browser - it is explicitly a
 * P014 verification surface, not a real business feature: no real business
 * record type exists yet to attach a document to (Suppliers/Purchase
 * Orders/Invoices are all still unbuilt). These Server Actions exist so a
 * future module's own Server Actions have a working pattern to copy.
 */

import {
  createDocumentLinkRepository,
  createDocumentRepository,
  createS3StorageProvider,
  loadS3StorageProviderConfigFromEnv,
  uploadDocument as engineUploadDocument,
  getDocumentUrl as engineGetDocumentUrl,
  hardDeleteDocument as engineHardDeleteDocument,
  DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  type Document as DocumentDomain,
  type DocumentLink as DocumentLinkDomain,
  type DocumentRecord,
  type DocumentLinkRecord,
} from '@nera/document-engine';
import { createOrganizationEngine } from '@nera/organization-engine';
import { createAuditEngine } from '@nera/audit-engine';
import { eventBus } from '@nera/event-bus-engine';
import { DEMO_MEMBERSHIP_ID, DEMO_USER_PROFILE_ID } from '@/src/lib/auth/demoIdentity';
import type { ActionResult } from './entityActions';
import { requirePermission } from './requirePermission';
import { buildSampleInvoiceRows, sampleInvoiceTemplate } from './sampleInvoiceTemplate';
import { generatePdf } from '@nera/document-engine';
import { randomUUID } from 'node:crypto';

const { getOrganizationContext } = createOrganizationEngine();

function getStorageProvider() {
  return createS3StorageProvider(loadS3StorageProviderConfigFromEnv());
}

function toDocumentDomain(record: DocumentRecord): DocumentDomain {
  return {
    id: record.id,
    organizationId: record.organizationId,
    status: record.status,
    storageKey: record.storageKey,
    originalFilename: record.originalFilename,
    contentType: record.contentType,
    fileSizeBytes: record.fileSizeBytes,
    checksumSha256: record.checksumSha256,
    createdByUserId: record.createdByUserId,
    deletedByUserId: record.deletedByUserId,
    purgedByUserId: record.purgedByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    purgedAt: record.purgedAt ? record.purgedAt.toISOString() : null,
    reconciledAt: record.reconciledAt ? record.reconciledAt.toISOString() : null,
  };
}

function toDocumentLinkDomain(record: DocumentLinkRecord): DocumentLinkDomain {
  return {
    id: record.id,
    organizationId: record.organizationId,
    documentId: record.documentId,
    targetRecordType: record.targetRecordType,
    targetRecordId: record.targetRecordId,
    linkedByUserId: record.linkedByUserId,
    createdAt: record.createdAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    deletedByUserId: record.deletedByUserId,
  };
}

/** Bulk read (mirrors listEntitiesAction's convention) - includes soft-deleted/purged documents so a verification UI can show their state and offer restore. */
export async function listDocumentsAction(
  organizationId: string
): Promise<ActionResult<DocumentDomain[]>> {
  const records = await getOrganizationContext({ organizationId }, tx =>
    createDocumentRepository(tx).listDocumentsForOrganization(organizationId)
  );
  return { ok: true, data: records.map(toDocumentDomain) };
}

export async function uploadDocumentAction(
  organizationId: string,
  formData: FormData
): Promise<ActionResult<DocumentDomain>> {
  const denyReason = await requirePermission(organizationId, 'documents.upload');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, reason: 'לא צורף קובץ.' };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const record = await engineUploadDocument(
      {
        organizationId,
        createdByUserId: DEMO_USER_PROFILE_ID,
        filename: file.name,
        declaredContentType: file.type,
        bytes,
      },
      getStorageProvider()
    );

    await getOrganizationContext({ organizationId }, async tx => {
      const audit = createAuditEngine(tx);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document.uploaded',
        entityType: 'document',
        entityId: record.id,
        newValues: {
          originalFilename: record.originalFilename,
          contentType: record.contentType,
          fileSizeBytes: record.fileSizeBytes,
        },
      });
    });

    await eventBus.publish({
      eventType: 'DocumentUploaded',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { documentId: record.id },
    });

    return { ok: true, data: toDocumentDomain(record) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

/**
 * P014 verification-only action: generates a real, multi-page Hebrew PDF
 * (via `sampleInvoiceTemplate`, standing in for a future real module's
 * template) and uploads it through the exact same `uploadDocument` path a
 * browser-submitted file goes through - real browser verification of the
 * font fix and the paginated-table header-repeat helper requires actually
 * opening a generated PDF, not just an automated `pdf.js` text-extraction
 * assertion. No real business module calls `generatePdf` yet.
 */
export async function generateSampleHebrewPdfAction(
  organizationId: string
): Promise<ActionResult<DocumentDomain>> {
  const denyReason = await requirePermission(organizationId, 'documents.upload');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const invoiceNumber = `INV-2026-${randomUUID().slice(0, 6).toUpperCase()}`;
    const bytes = await generatePdf(sampleInvoiceTemplate, {
      invoiceNumber,
      rows: buildSampleInvoiceRows(),
    });

    const record = await engineUploadDocument(
      {
        organizationId,
        createdByUserId: DEMO_USER_PROFILE_ID,
        filename: `חשבונית-לדוגמה-${invoiceNumber}.pdf`,
        declaredContentType: 'application/pdf',
        bytes,
      },
      getStorageProvider()
    );

    await getOrganizationContext({ organizationId }, async tx => {
      const audit = createAuditEngine(tx);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document.uploaded',
        entityType: 'document',
        entityId: record.id,
        newValues: { originalFilename: record.originalFilename, generated: true },
      });
    });

    await eventBus.publish({
      eventType: 'DocumentUploaded',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { documentId: record.id },
    });

    return { ok: true, data: toDocumentDomain(record) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function getDocumentUrlAction(
  organizationId: string,
  documentId: string
): Promise<ActionResult<{ url: string; expiresInSeconds: number }>> {
  const denyReason = await requirePermission(organizationId, 'documents.download');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const url = await engineGetDocumentUrl(documentId, organizationId, getStorageProvider());
    return { ok: true, data: { url, expiresInSeconds: DEFAULT_SIGNED_URL_EXPIRY_SECONDS } };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function deleteDocumentAction(
  organizationId: string,
  documentId: string
): Promise<ActionResult<DocumentDomain>> {
  const denyReason = await requirePermission(organizationId, 'documents.delete');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const record = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createDocumentRepository(tx);
      const audit = createAuditEngine(tx);
      const updated = await repo.softDeleteDocument(
        documentId,
        organizationId,
        DEMO_USER_PROFILE_ID
      );
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document.deleted',
        entityType: 'document',
        entityId: updated.id,
      });
      return updated;
    });

    await eventBus.publish({
      eventType: 'DocumentDeleted',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { documentId: record.id },
    });

    return { ok: true, data: toDocumentDomain(record) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function restoreDocumentAction(
  organizationId: string,
  documentId: string
): Promise<ActionResult<DocumentDomain>> {
  const denyReason = await requirePermission(organizationId, 'documents.restore');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const record = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createDocumentRepository(tx);
      const audit = createAuditEngine(tx);
      const updated = await repo.restoreDocument(documentId, organizationId);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document.restored',
        entityType: 'document',
        entityId: updated.id,
      });
      return updated;
    });

    return { ok: true, data: toDocumentDomain(record) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

/** Administrator-only (ADR-013 Decision item C.4) - a separate, heavily-guarded action, never a flag on deleteDocumentAction. */
export async function hardDeleteDocumentAction(
  organizationId: string,
  documentId: string
): Promise<ActionResult<{ documentId: string }>> {
  const denyReason = await requirePermission(organizationId, 'documents.hard_delete');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const record = await engineHardDeleteDocument(
      documentId,
      organizationId,
      DEMO_USER_PROFILE_ID,
      getStorageProvider()
    );

    await getOrganizationContext({ organizationId }, async tx => {
      const audit = createAuditEngine(tx);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document.hard_deleted',
        entityType: 'document',
        entityId: record.id,
      });
    });

    return { ok: true, data: { documentId: record.id } };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function listDocumentLinksForTargetRecordAction(
  organizationId: string,
  targetRecordType: string,
  targetRecordId: string
): Promise<ActionResult<DocumentLinkDomain[]>> {
  const records = await getOrganizationContext({ organizationId }, tx =>
    createDocumentLinkRepository(tx).listLinksForTargetRecord(
      targetRecordType,
      targetRecordId,
      organizationId
    )
  );
  return { ok: true, data: records.map(toDocumentLinkDomain) };
}

export async function linkDocumentAction(
  organizationId: string,
  documentId: string,
  targetRecordType: string,
  targetRecordId: string
): Promise<ActionResult<DocumentLinkDomain>> {
  const denyReason = await requirePermission(organizationId, 'documents.manage_links');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const record = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createDocumentLinkRepository(tx);
      const audit = createAuditEngine(tx);
      const created = await repo.createLink(organizationId, {
        organizationId,
        documentId,
        targetRecordType,
        targetRecordId,
        linkedByUserId: DEMO_USER_PROFILE_ID,
      });
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document_link.created',
        entityType: 'document_link',
        entityId: created.id,
        newValues: { documentId, targetRecordType, targetRecordId },
      });
      return created;
    });

    return { ok: true, data: toDocumentLinkDomain(record) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function unlinkDocumentAction(
  organizationId: string,
  linkId: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'documents.manage_links');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    await getOrganizationContext({ organizationId }, async tx => {
      const repo = createDocumentLinkRepository(tx);
      const audit = createAuditEngine(tx);
      await repo.removeLink(linkId, organizationId, DEMO_USER_PROFILE_ID);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document_link.removed',
        entityType: 'document_link',
        entityId: linkId,
      });
    });

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function restoreLinkAction(
  organizationId: string,
  linkId: string
): Promise<ActionResult<DocumentLinkDomain>> {
  const denyReason = await requirePermission(organizationId, 'documents.manage_links');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const record = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createDocumentLinkRepository(tx);
      const audit = createAuditEngine(tx);
      const restored = await repo.restoreLink(linkId, organizationId);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'document_link.restored',
        entityType: 'document_link',
        entityId: linkId,
      });
      return restored;
    });

    return { ok: true, data: toDocumentLinkDomain(record) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

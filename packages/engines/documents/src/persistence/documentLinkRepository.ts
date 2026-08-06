/**
 * DocumentLink persistence repository (ADR-013 Decision item D; P014). A
 * generic, module-agnostic many-to-many document-to-record link - the
 * Document Engine stays ignorant of business concepts such as "Invoice" or
 * "Purchase Order"; `targetRecordType`/`targetRecordId` are a plain
 * string/UUID pair, never a live FK to an unknown future table.
 *
 * Link rows are soft-deleted on unlink (Owner decision, P014 implementation
 * session), matching the standard soft-delete pattern used throughout the
 * repository. A soft-deleted link is excluded from every normal listing
 * (`listLinksForDocument`/`listLinksForTargetRecord`) and no longer counts
 * toward the duplicate-active-link check, so the same document can be
 * re-linked to the same target record after a prior link was removed - see
 * `schema.prisma`'s `DocumentLink` doc comment for the partial-unique-index
 * mechanics this depends on.
 */

import { appPrisma, type Prisma } from '@nera/database';
import type { NewDocumentLinkInput } from '../document.js';

export type DocumentLinkRecord = {
  id: string;
  organizationId: string;
  documentId: string;
  targetRecordType: string;
  targetRecordId: string;
  linkedByUserId: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedByUserId: string | null;
};

/** Explicit, type-checked input -> Prisma mapping. */
export function mapNewDocumentLinkInputForCreate(
  input: NewDocumentLinkInput
): Omit<Prisma.DocumentLinkUncheckedCreateInput, 'id' | 'organizationId'> {
  return {
    documentId: input.documentId,
    targetRecordType: input.targetRecordType,
    targetRecordId: input.targetRecordId,
    linkedByUserId: input.linkedByUserId,
  };
}

export type DocumentLinkRepositoryDbClient = {
  documentLink: {
    create(args: { data: Prisma.DocumentLinkUncheckedCreateInput }): Promise<DocumentLinkRecord>;
    findMany(args: {
      where: { organizationId: string; deletedAt?: null } & Partial<
        Pick<DocumentLinkRecord, 'documentId' | 'targetRecordType' | 'targetRecordId'>
      >;
    }): Promise<DocumentLinkRecord[]>;
    findFirst(args: {
      where: {
        documentId: string;
        targetRecordType: string;
        targetRecordId: string;
        deletedAt: null;
      };
    }): Promise<DocumentLinkRecord | null>;
    findUnique(args: { where: { id: string } }): Promise<DocumentLinkRecord | null>;
    update(args: {
      where: { id: string };
      data: Prisma.DocumentLinkUncheckedUpdateInput;
    }): Promise<DocumentLinkRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `documentLinkRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

async function assertOwnedByOrganization(
  client: DocumentLinkRepositoryDbClient,
  id: string,
  organizationId: string
): Promise<DocumentLinkRecord> {
  const record = await client.documentLink.findUnique({ where: { id } });
  if (!record || record.organizationId !== organizationId) {
    throw new Error(
      `documentLinkRepository: link "${id}" does not belong to organization "${organizationId}".`
    );
  }
  return record;
}

export type DocumentLinkRepository = {
  /** Active links only (`deletedAt IS NULL`) - a soft-deleted link is no longer a real link for callers. */
  listLinksForDocument(documentId: string, organizationId: string): Promise<DocumentLinkRecord[]>;
  listLinksForTargetRecord(
    targetRecordType: string,
    targetRecordId: string,
    organizationId: string
  ): Promise<DocumentLinkRecord[]>;
  createLink(organizationId: string, input: NewDocumentLinkInput): Promise<DocumentLinkRecord>;
  removeLink(id: string, organizationId: string, deletedByUserId: string): Promise<void>;
  restoreLink(id: string, organizationId: string): Promise<DocumentLinkRecord>;
};

export function createDocumentLinkRepository(
  client: DocumentLinkRepositoryDbClient = appPrisma
): DocumentLinkRepository {
  return {
    async listLinksForDocument(documentId, organizationId) {
      assertRequiredString('documentId', documentId);
      assertRequiredString('organizationId', organizationId);
      return client.documentLink.findMany({
        where: { organizationId, documentId, deletedAt: null },
      });
    },

    async listLinksForTargetRecord(targetRecordType, targetRecordId, organizationId) {
      assertRequiredString('targetRecordType', targetRecordType);
      assertRequiredString('targetRecordId', targetRecordId);
      assertRequiredString('organizationId', organizationId);
      return client.documentLink.findMany({
        where: { organizationId, targetRecordType, targetRecordId, deletedAt: null },
      });
    },

    async createLink(organizationId, input) {
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('documentId', input.documentId);
      assertRequiredString('targetRecordType', input.targetRecordType);
      assertRequiredString('targetRecordId', input.targetRecordId);
      assertRequiredString('linkedByUserId', input.linkedByUserId);

      const existing = await client.documentLink.findFirst({
        where: {
          documentId: input.documentId,
          targetRecordType: input.targetRecordType,
          targetRecordId: input.targetRecordId,
          deletedAt: null,
        },
      });
      if (existing) {
        throw new Error(
          `documentLinkRepository: document "${input.documentId}" is already linked to ${input.targetRecordType} "${input.targetRecordId}".`
        );
      }

      return client.documentLink.create({
        data: { organizationId, ...mapNewDocumentLinkInputForCreate(input) },
      });
    },

    async removeLink(id, organizationId, deletedByUserId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('deletedByUserId', deletedByUserId);

      const existing = await assertOwnedByOrganization(client, id, organizationId);
      if (existing.deletedAt) {
        throw new Error(`documentLinkRepository: link "${id}" is already removed.`);
      }

      await client.documentLink.update({
        where: { id },
        data: { deletedAt: new Date(), deletedByUserId },
      });
    },

    async restoreLink(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);

      const existing = await assertOwnedByOrganization(client, id, organizationId);
      if (!existing.deletedAt) {
        throw new Error(
          `documentLinkRepository: link "${id}" is not removed and cannot be restored.`
        );
      }

      return client.documentLink.update({
        where: { id },
        data: { deletedAt: null, deletedByUserId: null },
      });
    },
  };
}

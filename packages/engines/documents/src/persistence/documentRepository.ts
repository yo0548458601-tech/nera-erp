/**
 * Document persistence repository (ADR-011/ADR-013; P014). The upload
 * lifecycle (status: uploading/available/failed, ADR-011 Decision item 5)
 * and the deletion lifecycle (deletedAt/purgedAt, ADR-013 Decision item C)
 * are independent - each gets its own dedicated transition method below
 * rather than one generic "update" that could mix the two.
 *
 * `findStuckForReconciliation`/`findPurgeEligible` intentionally query
 * across every organization (no `organizationId` filter) - the
 * reconciliation and retention/purge services are platform-wide maintenance
 * jobs, not a real user request, so they must run against the admin
 * (table-owner) `prisma` client, never the RLS-scoped `appPrisma` default -
 * with `FORCE ROW LEVEL SECURITY` and no `app.current_organization_id`
 * session variable set, `appPrisma` would see zero rows from any
 * organization, not "all of them". This mirrors the existing precedent of
 * `prisma` being used by migrations/seed/bootstrap scripts
 * (`packages/database/README.md`), extended here to the one other
 * legitimate cross-tenant, non-request-scoped use case P014 introduces.
 */

import { appPrisma, type DocumentStatus as DbDocumentStatus, type Prisma } from '@nera/database';
import type { NewDocumentUploadInput } from '../document.js';

export type DocumentRecord = {
  id: string;
  organizationId: string;
  status: DbDocumentStatus;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  createdByUserId: string;
  deletedByUserId: string | null;
  purgedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  purgedAt: Date | null;
  reconciledAt: Date | null;
};

/** Explicit, type-checked input -> Prisma mapping (see `@nera/entity-engine`'s contactMethodRepository for the convention this follows). */
export function mapNewDocumentUploadInputForCreate(
  input: NewDocumentUploadInput
): Omit<Prisma.DocumentUncheckedCreateInput, 'id' | 'organizationId'> {
  return {
    status: 'uploading',
    storageKey: input.storageKey,
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
    checksumSha256: input.checksumSha256,
    createdByUserId: input.createdByUserId,
  };
}

export type DocumentRepositoryDbClient = {
  document: {
    create(args: { data: Prisma.DocumentUncheckedCreateInput }): Promise<DocumentRecord>;
    findUnique(args: { where: { id: string } }): Promise<DocumentRecord | null>;
    findMany(args: { where: Prisma.DocumentWhereInput }): Promise<DocumentRecord[]>;
    update(args: {
      where: { id: string };
      data: Prisma.DocumentUncheckedUpdateInput;
    }): Promise<DocumentRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`documentRepository: "${label}" is required and must be a non-empty string.`);
  }
}

async function assertOwnedByOrganization(
  client: DocumentRepositoryDbClient,
  id: string,
  organizationId: string
): Promise<DocumentRecord> {
  const record = await client.document.findUnique({ where: { id } });
  if (!record || record.organizationId !== organizationId) {
    throw new Error(
      `documentRepository: document "${id}" does not belong to organization "${organizationId}".`
    );
  }
  return record;
}

export type DocumentRepository = {
  getDocumentById(id: string, organizationId: string): Promise<DocumentRecord | null>;
  listDocumentsForOrganization(organizationId: string): Promise<DocumentRecord[]>;
  createUploadingDocument(
    organizationId: string,
    input: NewDocumentUploadInput
  ): Promise<DocumentRecord>;
  markDocumentAvailable(id: string, organizationId: string): Promise<DocumentRecord>;
  markDocumentFailed(id: string, organizationId: string): Promise<DocumentRecord>;
  softDeleteDocument(
    id: string,
    organizationId: string,
    deletedByUserId: string
  ): Promise<DocumentRecord>;
  restoreDocument(id: string, organizationId: string): Promise<DocumentRecord>;
  hardDeleteDocument(
    id: string,
    organizationId: string,
    purgedByUserId: string
  ): Promise<DocumentRecord>;
  /** Platform-wide (no organization filter) - see module doc comment. Caller must pass the admin `prisma` client. */
  findStuckForReconciliation(olderThan: Date): Promise<DocumentRecord[]>;
  markReconciled(id: string): Promise<DocumentRecord>;
  /** Platform-wide (no organization filter) - see module doc comment. Caller must pass the admin `prisma` client. */
  findPurgeEligible(olderThan: Date): Promise<DocumentRecord[]>;
  markPurged(id: string, purgedByUserId: string | null): Promise<DocumentRecord>;
};

export function createDocumentRepository(
  client: DocumentRepositoryDbClient = appPrisma
): DocumentRepository {
  return {
    async getDocumentById(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      const record = await client.document.findUnique({ where: { id } });
      return record && record.organizationId === organizationId ? record : null;
    },

    async listDocumentsForOrganization(organizationId) {
      assertRequiredString('organizationId', organizationId);
      return client.document.findMany({ where: { organizationId } });
    },

    async createUploadingDocument(organizationId, input) {
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('createdByUserId', input.createdByUserId);
      assertRequiredString('storageKey', input.storageKey);
      assertRequiredString('checksumSha256', input.checksumSha256);

      return client.document.create({
        data: {
          organizationId,
          ...mapNewDocumentUploadInputForCreate(input),
        },
      });
    },

    async markDocumentAvailable(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);
      return client.document.update({ where: { id }, data: { status: 'available' } });
    },

    async markDocumentFailed(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);
      return client.document.update({ where: { id }, data: { status: 'failed' } });
    },

    async softDeleteDocument(id, organizationId, deletedByUserId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('deletedByUserId', deletedByUserId);
      const existing = await assertOwnedByOrganization(client, id, organizationId);
      if (existing.status !== 'available') {
        throw new Error(
          `documentRepository: document "${id}" is not available and cannot be deleted (status "${existing.status}").`
        );
      }
      return client.document.update({
        where: { id },
        data: { deletedAt: new Date(), deletedByUserId },
      });
    },

    async restoreDocument(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      const existing = await assertOwnedByOrganization(client, id, organizationId);
      if (!existing.deletedAt || existing.purgedAt) {
        throw new Error(
          `documentRepository: document "${id}" is not within its recovery window and cannot be restored.`
        );
      }
      return client.document.update({
        where: { id },
        data: { deletedAt: null, deletedByUserId: null },
      });
    },

    async hardDeleteDocument(id, organizationId, purgedByUserId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('purgedByUserId', purgedByUserId);
      const existing = await assertOwnedByOrganization(client, id, organizationId);
      if (existing.purgedAt) {
        throw new Error(`documentRepository: document "${id}" has already been purged.`);
      }
      return client.document.update({
        where: { id },
        data: {
          deletedAt: existing.deletedAt ?? new Date(),
          deletedByUserId: existing.deletedByUserId ?? purgedByUserId,
          purgedAt: new Date(),
          purgedByUserId,
        },
      });
    },

    async findStuckForReconciliation(olderThan) {
      return client.document.findMany({
        where: {
          status: { in: ['uploading', 'failed'] },
          reconciledAt: null,
          createdAt: { lt: olderThan },
        },
      });
    },

    async markReconciled(id) {
      assertRequiredString('id', id);
      return client.document.update({ where: { id }, data: { reconciledAt: new Date() } });
    },

    async findPurgeEligible(olderThan) {
      return client.document.findMany({
        where: {
          deletedAt: { not: null, lt: olderThan },
          purgedAt: null,
        },
      });
    },

    async markPurged(id, purgedByUserId) {
      assertRequiredString('id', id);
      return client.document.update({
        where: { id },
        data: { purgedAt: new Date(), purgedByUserId: purgedByUserId ?? undefined },
      });
    },
  };
}

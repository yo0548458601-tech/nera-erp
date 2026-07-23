/**
 * Entity persistence repository (P013A - see `docs/ROADMAP.md`).
 *
 * Pure persistence only: create/read/update/archive/restore against the
 * `entities` table. Deliberately contains no audit-write and no
 * event-publish logic - those are composed by the caller (a Server Action
 * in `apps/web`), which already holds the same transaction client this
 * repository was constructed with, so a mutation, its audit row, and its
 * event publish can be sequenced correctly by the one caller that knows
 * about all three, without this package depending on `@nera/audit-engine`
 * or `@nera/event-bus-engine` at all.
 *
 * `notesMetadata` (count/lastNoteAt) is deliberately never stored or
 * returned as a cached value - see `getNotesMetadata` below, computed live.
 */

import { appPrisma, type EntityStatus, type EntityType, type Prisma } from '@nera/database';
import { formatNeraId } from '../neraId.js';

export type EntityRecord = {
  id: string;
  organizationId: string;
  neraId: string;
  entityType: EntityType;
  status: EntityStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type EntityRepositoryDbClient = {
  entity: {
    create(args: { data: Prisma.EntityUncheckedCreateInput }): Promise<EntityRecord>;
    findUnique(args: { where: { id: string } }): Promise<EntityRecord | null>;
    findFirst(args: {
      where: { organizationId: string };
      orderBy: { createdAt: 'desc' };
    }): Promise<Pick<EntityRecord, 'neraId'> | null>;
    findMany(args: { where: { organizationId: string } }): Promise<EntityRecord[]>;
    update(args: {
      where: { id: string };
      data: Prisma.EntityUncheckedUpdateInput;
    }): Promise<EntityRecord>;
  };
  note: {
    aggregate(args: {
      where: { entityId: string; deletedAt: null };
      _count: { _all: true };
      _max: { createdAt: true };
    }): Promise<{ _count: { _all: number }; _max: { createdAt: Date | null } }>;
  };
};

export type CreateEntityInput = {
  organizationId: string;
  entityType: EntityType;
  tags?: string[];
};

export type UpdateEntityInput = {
  id: string;
  organizationId: string;
  status?: EntityStatus;
  tags?: string[];
};

export type EntityRepository = {
  createEntity(input: CreateEntityInput): Promise<EntityRecord>;
  getEntityById(id: string, organizationId: string): Promise<EntityRecord | null>;
  updateEntity(input: UpdateEntityInput): Promise<EntityRecord>;
  archiveEntity(id: string, organizationId: string): Promise<EntityRecord>;
  restoreEntity(id: string, organizationId: string): Promise<EntityRecord>;
  listEntities(organizationId: string): Promise<EntityRecord[]>;
  getNotesMetadata(entityId: string): Promise<{ count: number; lastNoteAt: Date | null }>;
};

const NERA_ID_START = 100;

async function nextNeraId(
  client: EntityRepositoryDbClient,
  organizationId: string
): Promise<string> {
  const latest = await client.entity.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  if (!latest) {
    return formatNeraId(NERA_ID_START);
  }

  const digits = Number(latest.neraId.replace(/^\D+/, ''));
  return formatNeraId(digits + 1);
}

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`entityRepository: "${label}" is required and must be a non-empty string.`);
  }
}

/**
 * Confirms `id` belongs to `organizationId` before any mutation - never
 * relies on RLS alone (RLS is a second, independent layer, not a substitute
 * for this explicit, application-level check - see `docs/ROADMAP.md` P013A
 * RLS design notes).
 */
async function assertOwnedByOrganization(
  client: EntityRepositoryDbClient,
  id: string,
  organizationId: string
): Promise<void> {
  const entity = await client.entity.findUnique({ where: { id } });
  if (!entity || entity.organizationId !== organizationId) {
    throw new Error(
      `entityRepository: entity "${id}" does not belong to organization "${organizationId}".`
    );
  }
}

export function createEntityRepository(
  client: EntityRepositoryDbClient = appPrisma
): EntityRepository {
  return {
    async createEntity(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('entityType', input.entityType);

      const neraId = await nextNeraId(client, input.organizationId);

      return client.entity.create({
        data: {
          organizationId: input.organizationId,
          neraId,
          entityType: input.entityType,
          tags: input.tags ?? [],
        },
      });
    },

    async getEntityById(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);

      const entity = await client.entity.findUnique({ where: { id } });
      if (!entity || entity.organizationId !== organizationId) {
        return null;
      }
      return entity;
    },

    async updateEntity(input) {
      assertRequiredString('id', input.id);
      assertRequiredString('organizationId', input.organizationId);
      await assertOwnedByOrganization(client, input.id, input.organizationId);

      return client.entity.update({
        where: { id: input.id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.tags ? { tags: input.tags } : {}),
        },
      });
    },

    async archiveEntity(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);

      return client.entity.update({ where: { id }, data: { status: 'archived' } });
    },

    async restoreEntity(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);

      return client.entity.update({ where: { id }, data: { status: 'active' } });
    },

    async listEntities(organizationId) {
      assertRequiredString('organizationId', organizationId);

      return client.entity.findMany({ where: { organizationId } });
    },

    async getNotesMetadata(entityId) {
      assertRequiredString('entityId', entityId);

      const result = await client.note.aggregate({
        where: { entityId, deletedAt: null },
        _count: { _all: true },
        _max: { createdAt: true },
      });

      return { count: result._count._all, lastNoteAt: result._max.createdAt };
    },
  };
}

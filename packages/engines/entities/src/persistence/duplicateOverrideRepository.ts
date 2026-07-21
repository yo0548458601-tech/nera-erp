/**
 * DuplicateOverrideRecord persistence repository (P013A - see
 * `docs/ROADMAP.md`). `matchedEntityIds` is a plain UUID array snapshot, not
 * a live FK - an intentional point-in-time record; a later archive/delete of
 * a matched entity never affects this historical record. No uniqueness
 * constraint: the same conflict may legitimately be overridden more than
 * once as data evolves.
 */

import { appPrisma, type Prisma } from '@nera/database';
import type { DuplicateMatchReason } from '../duplicates.js';

export type DuplicateOverrideRecordRow = {
  id: string;
  organizationId: string;
  entityId: string;
  matchedEntityIds: string[];
  matchReasons: DuplicateMatchReason[];
  overrideReason: string;
  decidedByUserId: string;
  decidedAt: Date;
};

/**
 * The raw shape Prisma actually returns: `match_reasons` is a plain
 * `TEXT[]` column (no Postgres enum - see the P013A design review), so
 * Prisma's generated type is `string[]`, not `DuplicateMatchReason[]`. The
 * repository casts to the narrower, domain-typed `DuplicateOverrideRecordRow`
 * at its public boundary (matching `DuplicateMatchReason`'s own definition
 * in `duplicates.ts` - the column is validated against this union at the
 * application layer, never by the database).
 */
type RawDuplicateOverrideRecordRow = Omit<DuplicateOverrideRecordRow, 'matchReasons'> & {
  matchReasons: string[];
};

export type DuplicateOverrideRepositoryDbClient = {
  duplicateOverrideRecord: {
    create(args: {
      data: Prisma.DuplicateOverrideRecordUncheckedCreateInput;
    }): Promise<RawDuplicateOverrideRecordRow>;
    findMany(args: { where: { entityId: string } }): Promise<RawDuplicateOverrideRecordRow[]>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `duplicateOverrideRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

export type RecordDuplicateOverrideInput = {
  organizationId: string;
  entityId: string;
  matchedEntityIds: string[];
  matchReasons: DuplicateMatchReason[];
  overrideReason: string;
  decidedByUserId: string;
};

export type DuplicateOverrideRepository = {
  recordDuplicateOverride(input: RecordDuplicateOverrideInput): Promise<DuplicateOverrideRecordRow>;
  listDuplicateOverrides(entityId: string): Promise<DuplicateOverrideRecordRow[]>;
};

export function createDuplicateOverrideRepository(
  client: DuplicateOverrideRepositoryDbClient = appPrisma
): DuplicateOverrideRepository {
  return {
    async recordDuplicateOverride(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('entityId', input.entityId);
      assertRequiredString('overrideReason', input.overrideReason);
      assertRequiredString('decidedByUserId', input.decidedByUserId);

      const created = await client.duplicateOverrideRecord.create({
        data: {
          organizationId: input.organizationId,
          entityId: input.entityId,
          matchedEntityIds: input.matchedEntityIds,
          matchReasons: input.matchReasons,
          overrideReason: input.overrideReason,
          decidedByUserId: input.decidedByUserId,
        },
      });
      return { ...created, matchReasons: created.matchReasons as DuplicateMatchReason[] };
    },

    async listDuplicateOverrides(entityId) {
      assertRequiredString('entityId', entityId);
      const rows = await client.duplicateOverrideRecord.findMany({ where: { entityId } });
      return rows.map(row => ({
        ...row,
        matchReasons: row.matchReasons as DuplicateMatchReason[],
      }));
    },
  };
}

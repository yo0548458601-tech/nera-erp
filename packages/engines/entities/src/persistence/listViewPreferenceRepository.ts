/**
 * ListViewColumnPreference persistence repository (P013A - see
 * `docs/ROADMAP.md`). Mirrors the precedence already defined by
 * `@nera/customization-engine`'s `resolveEffectiveListViewColumns` (user ->
 * role -> institution -> system -> built-in default), now resolved against
 * real rows instead of an in-memory rules array. `targetId` is heterogeneous
 * by scope: a UserProfile id for 'user', a `Role.id` (the organization role a
 * membership holds, matching `resolveEffectiveListViewColumns`'s own
 * `context.roleIds` - NOT an entity-role-registry key) for 'role', an
 * Institution id for 'institution', and unused (`null`) for 'system'.
 *
 * "Reset" means deleting the row for that scope/target/screen - the
 * resolution cascade then naturally falls through to the next level.
 */

import { appPrisma, type ListViewPreferenceScope, type Prisma } from '@nera/database';

export type ListViewColumnPreferenceRecord = {
  id: string;
  organizationId: string;
  scope: ListViewPreferenceScope;
  targetId: string | null;
  screenId: string;
  visibleColumnKeys: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type ListViewPreferenceRepositoryDbClient = {
  listViewColumnPreference: {
    findMany(args: {
      where: { organizationId: string; screenId: string };
    }): Promise<ListViewColumnPreferenceRecord[]>;
    findFirst(args: {
      where: {
        organizationId: string;
        scope: ListViewPreferenceScope;
        targetId?: string | null;
        screenId: string;
      };
    }): Promise<ListViewColumnPreferenceRecord | null>;
    create(args: {
      data: Prisma.ListViewColumnPreferenceUncheckedCreateInput;
    }): Promise<ListViewColumnPreferenceRecord>;
    update(args: {
      where: { id: string };
      data: Prisma.ListViewColumnPreferenceUncheckedUpdateInput;
    }): Promise<ListViewColumnPreferenceRecord>;
    deleteMany(args: {
      where: {
        organizationId: string;
        scope: ListViewPreferenceScope;
        targetId?: string | null;
        screenId: string;
      };
    }): Promise<{ count: number }>;
  };
};

export type ListViewPreferenceResolutionContext = {
  organizationId: string;
  userId: string;
  roleIds: string[];
  institutionId?: string;
};

export type EffectiveListViewColumns = {
  screenId: string;
  visibleColumnKeys: string[];
  source: ListViewPreferenceScope | 'default';
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `listViewPreferenceRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

export type ListViewPreferenceRepository = {
  getEffectivePreference(
    screenId: string,
    context: ListViewPreferenceResolutionContext,
    builtInDefaultColumnKeys: string[]
  ): Promise<EffectiveListViewColumns>;
  setPreference(input: {
    organizationId: string;
    scope: ListViewPreferenceScope;
    targetId?: string;
    screenId: string;
    visibleColumnKeys: string[];
  }): Promise<ListViewColumnPreferenceRecord>;
  resetPreference(input: {
    organizationId: string;
    scope: ListViewPreferenceScope;
    targetId?: string;
    screenId: string;
  }): Promise<void>;
};

export function createListViewPreferenceRepository(
  client: ListViewPreferenceRepositoryDbClient = appPrisma
): ListViewPreferenceRepository {
  return {
    async getEffectivePreference(screenId, context, builtInDefaultColumnKeys) {
      assertRequiredString('screenId', screenId);
      assertRequiredString('organizationId', context.organizationId);
      assertRequiredString('userId', context.userId);

      const rows = await client.listViewColumnPreference.findMany({
        where: { organizationId: context.organizationId, screenId },
      });

      const userRow = rows.find(row => row.scope === 'user' && row.targetId === context.userId);
      if (userRow) {
        return { screenId, visibleColumnKeys: userRow.visibleColumnKeys, source: 'user' };
      }

      const roleRow = rows.find(
        row =>
          row.scope === 'role' && row.targetId !== null && context.roleIds.includes(row.targetId)
      );
      if (roleRow) {
        return { screenId, visibleColumnKeys: roleRow.visibleColumnKeys, source: 'role' };
      }

      const institutionRow = rows.find(
        row => row.scope === 'institution' && row.targetId === (context.institutionId ?? null)
      );
      if (institutionRow) {
        return {
          screenId,
          visibleColumnKeys: institutionRow.visibleColumnKeys,
          source: 'institution',
        };
      }

      const systemRow = rows.find(row => row.scope === 'system');
      if (systemRow) {
        return { screenId, visibleColumnKeys: systemRow.visibleColumnKeys, source: 'system' };
      }

      return { screenId, visibleColumnKeys: builtInDefaultColumnKeys, source: 'default' };
    },

    async setPreference(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('screenId', input.screenId);
      if (input.scope !== 'system') {
        assertRequiredString('targetId', input.targetId);
      }

      const targetId = input.scope === 'system' ? null : (input.targetId as string);

      // No `@@unique` exists for (organizationId, scope, targetId, screenId) in
      // schema.prisma - the real uniqueness constraint is the two partial
      // indexes added directly in the P013A migration (Prisma does not
      // support partial/conditional unique constraints natively), so a
      // Prisma-level `upsert` keyed on that tuple isn't available. This
      // find-then-create-or-update has a narrow race window under
      // concurrent first-writes; the database-level partial unique index
      // remains the real guarantee (defense in depth, matching the same
      // pattern already used for contact methods' primary flag).
      const existing = await client.listViewColumnPreference.findFirst({
        where: {
          organizationId: input.organizationId,
          scope: input.scope,
          targetId,
          screenId: input.screenId,
        },
      });

      if (existing) {
        return client.listViewColumnPreference.update({
          where: { id: existing.id },
          data: { visibleColumnKeys: input.visibleColumnKeys },
        });
      }

      return client.listViewColumnPreference.create({
        data: {
          organizationId: input.organizationId,
          scope: input.scope,
          targetId,
          screenId: input.screenId,
          visibleColumnKeys: input.visibleColumnKeys,
        },
      });
    },

    async resetPreference(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('screenId', input.screenId);

      await client.listViewColumnPreference.deleteMany({
        where: {
          organizationId: input.organizationId,
          scope: input.scope,
          targetId: input.scope === 'system' ? null : input.targetId,
          screenId: input.screenId,
        },
      });
    },
  };
}

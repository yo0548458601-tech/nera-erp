/**
 * RoleDefinition persistence repository (P013B - see `docs/ROADMAP.md`;
 * Owner decision 4: kept inside the Entity Engine's own persistence
 * structure, not moved to `@nera/customization-engine`, even though the
 * settings surface for it sits alongside Custom Fields/Field Requirements
 * in the UI).
 *
 * No institution scoping (Owner decision 3): the `role_definitions` table
 * has no `institution_id` column, even though the pure `RoleDefinition`
 * type (`../roles.js`) still carries an optional `institutionId` field.
 * Every mapper below deliberately drops it on both create and update - a
 * role definition persisted through this repository always applies across
 * the whole organization. The settings UI never offers an institution
 * scope for role definitions in this sprint, so this is not a silent gap.
 *
 * Every organization gets its own copy of the 12 built-in roles (rather
 * than a nullable-organizationId "global" row, unlike `Permission`) so this
 * table's RLS policy stays uniform with every other organization-scoped
 * table. Built-in seeding lives in `packages/database/src/seed.ts` (Platform
 * layer, cannot import this Core Engine package - see
 * `packages/core/src/dependencyRules.ts`), not here; this repository only
 * ever reads/creates/updates rows already scoped to one organization.
 */

import {
  appPrisma,
  type Prisma,
  type RoleDefinitionStatus as DbRoleDefinitionStatus,
} from '@nera/database';
import type { EntityType } from '../entity.js';
import type { RoleDefinitionPatch, NewRoleDefinitionInput } from '../roles.js';

export type RoleDefinitionRecord = {
  id: string;
  organizationId: string;
  key: string;
  label: string;
  description: string;
  applicableEntityTypes: EntityType[];
  status: DbRoleDefinitionStatus;
  order: number;
  icon: string | null;
  showInGlobalAddNew: boolean;
  allowMultipleAssignments: boolean;
  supportsDateRange: boolean;
  supportsBillingProfile: boolean;
  requiredPermissions: Prisma.JsonValue;
  linkedCustomFieldDefinitionIds: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/**
 * Explicit, type-checked input -> Prisma mapping (see contactMethodRepository
 * for the established convention this follows). `institutionId` is
 * deliberately not accepted here - see module doc comment.
 */
export function mapRoleDefinitionInputForCreate(
  input: NewRoleDefinitionInput
): Omit<Prisma.RoleDefinitionUncheckedCreateInput, 'id' | 'organizationId'> {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    applicableEntityTypes: input.applicableEntityTypes,
    order: 0,
    icon: input.icon ?? null,
    showInGlobalAddNew: input.showInGlobalAddNew,
    allowMultipleAssignments: input.allowMultipleAssignments,
    supportsDateRange: input.supportsDateRange,
    supportsBillingProfile: input.supportsBillingProfile,
    requiredPermissions: {},
    linkedCustomFieldDefinitionIds: [],
    isSystem: false,
  };
}

export function mapRoleDefinitionPatchForUpdate(
  patch: RoleDefinitionPatch
): Prisma.RoleDefinitionUncheckedUpdateInput {
  const data: Prisma.RoleDefinitionUncheckedUpdateInput = {};
  if (patch.label !== undefined) data.label = patch.label;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.applicableEntityTypes !== undefined) {
    data.applicableEntityTypes = patch.applicableEntityTypes;
  }
  if (patch.showInGlobalAddNew !== undefined) data.showInGlobalAddNew = patch.showInGlobalAddNew;
  if (patch.allowMultipleAssignments !== undefined) {
    data.allowMultipleAssignments = patch.allowMultipleAssignments;
  }
  if (patch.supportsDateRange !== undefined) data.supportsDateRange = patch.supportsDateRange;
  if (patch.supportsBillingProfile !== undefined) {
    data.supportsBillingProfile = patch.supportsBillingProfile;
  }
  if (patch.icon !== undefined) data.icon = patch.icon ?? null;
  if (patch.order !== undefined) data.order = patch.order;
  return data;
}

export type RoleDefinitionRepositoryDbClient = {
  roleDefinition: {
    create(args: {
      data: Prisma.RoleDefinitionUncheckedCreateInput;
    }): Promise<RoleDefinitionRecord>;
    findMany(args: { where: { organizationId: string } }): Promise<RoleDefinitionRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<RoleDefinitionRecord | null>;
    findFirst(args: {
      where: { organizationId: string; key: string };
    }): Promise<RoleDefinitionRecord | null>;
    update(args: {
      where: { id: string };
      data: Prisma.RoleDefinitionUncheckedUpdateInput;
    }): Promise<RoleDefinitionRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `roleDefinitionRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

async function assertOwnedByOrganization(
  client: RoleDefinitionRepositoryDbClient,
  id: string,
  organizationId: string
): Promise<RoleDefinitionRecord> {
  const record = await client.roleDefinition.findUnique({ where: { id } });
  if (!record || record.organizationId !== organizationId) {
    throw new Error(
      `roleDefinitionRepository: role definition "${id}" does not belong to organization "${organizationId}".`
    );
  }
  return record;
}

export type RoleDefinitionRepository = {
  listRoleDefinitions(organizationId: string): Promise<RoleDefinitionRecord[]>;
  getRoleDefinitionByKey(organizationId: string, key: string): Promise<RoleDefinitionRecord | null>;
  createRoleDefinition(
    organizationId: string,
    input: NewRoleDefinitionInput
  ): Promise<RoleDefinitionRecord>;
  updateRoleDefinition(
    id: string,
    organizationId: string,
    patch: RoleDefinitionPatch
  ): Promise<RoleDefinitionRecord>;
  setRoleDefinitionStatus(
    id: string,
    organizationId: string,
    status: DbRoleDefinitionStatus
  ): Promise<RoleDefinitionRecord>;
};

export function createRoleDefinitionRepository(
  client: RoleDefinitionRepositoryDbClient = appPrisma
): RoleDefinitionRepository {
  return {
    async listRoleDefinitions(organizationId) {
      assertRequiredString('organizationId', organizationId);
      return client.roleDefinition.findMany({ where: { organizationId } });
    },

    async getRoleDefinitionByKey(organizationId, key) {
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('key', key);
      return client.roleDefinition.findFirst({ where: { organizationId, key } });
    },

    async createRoleDefinition(organizationId, input) {
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('key', input.key);
      assertRequiredString('label', input.label);

      const existing = await client.roleDefinition.findFirst({
        where: { organizationId, key: input.key },
      });
      if (existing) {
        throw new Error(
          `roleDefinitionRepository: a role definition with key "${input.key}" already exists for organization "${organizationId}".`
        );
      }

      return client.roleDefinition.create({
        data: {
          organizationId,
          ...mapRoleDefinitionInputForCreate(input),
        },
      });
    },

    async updateRoleDefinition(id, organizationId, patch) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);

      return client.roleDefinition.update({
        where: { id },
        data: mapRoleDefinitionPatchForUpdate(patch),
      });
    },

    async setRoleDefinitionStatus(id, organizationId, status) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);

      return client.roleDefinition.update({ where: { id }, data: { status } });
    },
  };
}

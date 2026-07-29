/**
 * FieldRequirementRule persistence repository (P013B - see
 * `docs/ROADMAP.md`; Owner decision 3). `targetId` is heterogeneous by
 * scope, matching `@nera/entity-engine`'s `ListViewColumnPreference.targetId`
 * convention - a RoleDefinition.key for 'role', a module id for 'module', an
 * EntityType for 'entity_type'. 'institution' remains a valid
 * `FieldRequirementScope` value on the pure engine type (`../fieldRequirements.js`)
 * but the settings UI never offers it in this sprint, so no row of this
 * table is ever expected to carry that scope in practice.
 */

import { appPrisma, type Prisma } from '@nera/database';
import type { FieldRequirementMode, FieldRequirementScope } from '../fieldRequirements.js';

export type FieldRequirementRuleRecord = {
  id: string;
  organizationId: string;
  fieldKey: string;
  scope: FieldRequirementScope;
  targetId: string;
  mode: FieldRequirementMode;
  updatedByUserId: string | null;
  updatedAt: Date;
};

export type FieldRequirementRuleRepositoryDbClient = {
  fieldRequirementRule: {
    findMany(args: { where: { organizationId: string } }): Promise<FieldRequirementRuleRecord[]>;
    findFirst(args: {
      where: {
        organizationId: string;
        fieldKey: string;
        scope: FieldRequirementScope;
        targetId: string;
      };
    }): Promise<FieldRequirementRuleRecord | null>;
    create(args: {
      data: Prisma.FieldRequirementRuleUncheckedCreateInput;
    }): Promise<FieldRequirementRuleRecord>;
    update(args: {
      where: { id: string };
      data: Prisma.FieldRequirementRuleUncheckedUpdateInput;
    }): Promise<FieldRequirementRuleRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `fieldRequirementRuleRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

export type FieldRequirementRuleRepository = {
  listRulesForOrganization(organizationId: string): Promise<FieldRequirementRuleRecord[]>;
  setRule(input: {
    organizationId: string;
    fieldKey: string;
    scope: FieldRequirementScope;
    targetId: string;
    mode: FieldRequirementMode;
    updatedByUserId: string;
  }): Promise<FieldRequirementRuleRecord>;
};

export function createFieldRequirementRuleRepository(
  client: FieldRequirementRuleRepositoryDbClient = appPrisma
): FieldRequirementRuleRepository {
  return {
    async listRulesForOrganization(organizationId) {
      assertRequiredString('organizationId', organizationId);
      return client.fieldRequirementRule.findMany({ where: { organizationId } });
    },

    async setRule(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('fieldKey', input.fieldKey);
      assertRequiredString('targetId', input.targetId);
      assertRequiredString('updatedByUserId', input.updatedByUserId);

      const existing = await client.fieldRequirementRule.findFirst({
        where: {
          organizationId: input.organizationId,
          fieldKey: input.fieldKey,
          scope: input.scope,
          targetId: input.targetId,
        },
      });

      if (existing) {
        return client.fieldRequirementRule.update({
          where: { id: existing.id },
          data: { mode: input.mode, updatedByUserId: input.updatedByUserId },
        });
      }

      return client.fieldRequirementRule.create({
        data: {
          organizationId: input.organizationId,
          fieldKey: input.fieldKey,
          scope: input.scope,
          targetId: input.targetId,
          mode: input.mode,
          updatedByUserId: input.updatedByUserId,
        },
      });
    },
  };
}

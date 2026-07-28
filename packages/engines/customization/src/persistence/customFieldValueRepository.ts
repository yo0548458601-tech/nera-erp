/**
 * CustomFieldValue persistence repository (P013B - see `docs/ROADMAP.md`;
 * Owner decision 5). `value` is a single jsonb column holding the
 * `CustomFieldValueData` discriminated union - validated against its
 * definition at the application boundary (`validateCustomFieldValue`,
 * reused unchanged from `../customFields.js`) before this repository is
 * ever called, not by a database constraint.
 */

import { appPrisma, type Prisma } from '@nera/database';
import type { CustomFieldValueData } from '../customFields.js';

export type CustomFieldValueRecord = {
  id: string;
  organizationId: string;
  customFieldDefinitionId: string;
  entityId: string;
  value: Prisma.JsonValue;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomFieldValueRepositoryDbClient = {
  customFieldValue: {
    findMany(args: {
      where: { entityId: string } | { organizationId: string };
    }): Promise<CustomFieldValueRecord[]>;
    findFirst(args: {
      where: { entityId: string; customFieldDefinitionId: string };
    }): Promise<CustomFieldValueRecord | null>;
    create(args: {
      data: Prisma.CustomFieldValueUncheckedCreateInput;
    }): Promise<CustomFieldValueRecord>;
    update(args: {
      where: { id: string };
      data: Prisma.CustomFieldValueUncheckedUpdateInput;
    }): Promise<CustomFieldValueRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `customFieldValueRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

export type CustomFieldValueRepository = {
  listValuesForEntity(entityId: string): Promise<CustomFieldValueRecord[]>;
  /** Bulk read for list/export screens that need every entity's values at once (mirrors entityRepository.listEntities's bulk-load convention) - not paginated, matching this platform's current demo scale. */
  listValuesForOrganization(organizationId: string): Promise<CustomFieldValueRecord[]>;
  setValue(input: {
    organizationId: string;
    entityId: string;
    customFieldDefinitionId: string;
    value: CustomFieldValueData;
    updatedByUserId: string;
  }): Promise<CustomFieldValueRecord>;
};

export function createCustomFieldValueRepository(
  client: CustomFieldValueRepositoryDbClient = appPrisma
): CustomFieldValueRepository {
  return {
    async listValuesForEntity(entityId) {
      assertRequiredString('entityId', entityId);
      return client.customFieldValue.findMany({ where: { entityId } });
    },

    async listValuesForOrganization(organizationId) {
      assertRequiredString('organizationId', organizationId);
      return client.customFieldValue.findMany({ where: { organizationId } });
    },

    async setValue(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('entityId', input.entityId);
      assertRequiredString('customFieldDefinitionId', input.customFieldDefinitionId);
      assertRequiredString('updatedByUserId', input.updatedByUserId);

      const existing = await client.customFieldValue.findFirst({
        where: { entityId: input.entityId, customFieldDefinitionId: input.customFieldDefinitionId },
      });

      if (existing) {
        return client.customFieldValue.update({
          where: { id: existing.id },
          data: { value: input.value, updatedByUserId: input.updatedByUserId },
        });
      }

      return client.customFieldValue.create({
        data: {
          organizationId: input.organizationId,
          entityId: input.entityId,
          customFieldDefinitionId: input.customFieldDefinitionId,
          value: input.value,
          updatedByUserId: input.updatedByUserId,
        },
      });
    },
  };
}

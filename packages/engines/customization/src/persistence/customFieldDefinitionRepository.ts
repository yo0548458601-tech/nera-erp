/**
 * CustomFieldDefinition persistence repository (P013B - see
 * `docs/ROADMAP.md`; Owner decision 3). Organization-scoped only - no
 * `institution_id` column exists on this table even though the pure
 * `CustomFieldTargetScope` type (`../customFields.js`) still carries an
 * 'institution' value and `CustomFieldDefinition.institutionId` still
 * exists on the type; both are dropped on every write here. The settings UI
 * never offers 'institution' as a selectable scope in this sprint.
 */

import { appPrisma, type EntityType, type Prisma } from '@nera/database';
import type { NewCustomFieldInput } from '../customFields.js';

export type CustomFieldDefinitionRecord = {
  id: string;
  organizationId: string;
  key: string;
  label: string;
  description: string | null;
  helpText: string | null;
  fieldType: string;
  targetScope: string;
  targetEntityType: EntityType | null;
  targetRoleKey: string | null;
  targetModuleId: string | null;
  required: boolean;
  defaultValue: Prisma.JsonValue;
  validation: Prisma.JsonValue;
  options: Prisma.JsonValue;
  showInList: boolean;
  showInDetail: boolean;
  filterable: boolean;
  searchable: boolean;
  includeInExcelExport: boolean;
  includeInExcelImport: boolean;
  viewPermission: string | null;
  editPermission: string | null;
  order: number;
  section: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/**
 * Explicit, type-checked input -> Prisma mapping (see
 * `@nera/entity-engine`'s contactMethodRepository for the convention this
 * follows). `institutionId` is deliberately not accepted - see module doc
 * comment.
 */
export function mapCustomFieldInputForCreate(
  input: NewCustomFieldInput
): Omit<Prisma.CustomFieldDefinitionUncheckedCreateInput, 'id' | 'organizationId' | 'order'> {
  return {
    key: input.key,
    label: input.label,
    description: input.description ?? null,
    helpText: undefined,
    fieldType: input.fieldType,
    targetScope: input.targetScope,
    targetEntityType: input.targetEntityType ?? null,
    targetRoleKey: input.targetRoleKey ?? null,
    targetModuleId: input.targetModuleId ?? null,
    required: input.required,
    validation: input.validation ?? undefined,
    options: input.options ?? undefined,
    showInList: input.showInList,
    showInDetail: input.showInDetail,
    filterable: input.filterable,
    searchable: input.searchable,
    includeInExcelExport: input.includeInExcelExport,
    includeInExcelImport: input.includeInExcelImport,
    viewPermission: input.viewPermission ?? null,
    editPermission: input.editPermission ?? null,
    section: input.section ?? null,
    status: 'active',
  };
}

export type CustomFieldDefinitionRepositoryDbClient = {
  customFieldDefinition: {
    create(args: {
      data: Prisma.CustomFieldDefinitionUncheckedCreateInput;
    }): Promise<CustomFieldDefinitionRecord>;
    findMany(args: { where: { organizationId: string } }): Promise<CustomFieldDefinitionRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<CustomFieldDefinitionRecord | null>;
    findFirst(args: {
      where: { organizationId: string; key: string };
    }): Promise<CustomFieldDefinitionRecord | null>;
    count(args: { where: { organizationId: string } }): Promise<number>;
    update(args: {
      where: { id: string };
      data: Prisma.CustomFieldDefinitionUncheckedUpdateInput;
    }): Promise<CustomFieldDefinitionRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `customFieldDefinitionRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

async function assertOwnedByOrganization(
  client: CustomFieldDefinitionRepositoryDbClient,
  id: string,
  organizationId: string
): Promise<CustomFieldDefinitionRecord> {
  const record = await client.customFieldDefinition.findUnique({ where: { id } });
  if (!record || record.organizationId !== organizationId) {
    throw new Error(
      `customFieldDefinitionRepository: definition "${id}" does not belong to organization "${organizationId}".`
    );
  }
  return record;
}

export type CustomFieldDefinitionRepository = {
  listCustomFieldDefinitions(organizationId: string): Promise<CustomFieldDefinitionRecord[]>;
  createCustomFieldDefinition(
    organizationId: string,
    input: NewCustomFieldInput
  ): Promise<CustomFieldDefinitionRecord>;
  setCustomFieldDefinitionStatus(
    id: string,
    organizationId: string,
    status: 'active' | 'inactive'
  ): Promise<CustomFieldDefinitionRecord>;
};

export function createCustomFieldDefinitionRepository(
  client: CustomFieldDefinitionRepositoryDbClient = appPrisma
): CustomFieldDefinitionRepository {
  return {
    async listCustomFieldDefinitions(organizationId) {
      assertRequiredString('organizationId', organizationId);
      return client.customFieldDefinition.findMany({ where: { organizationId } });
    },

    async createCustomFieldDefinition(organizationId, input) {
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('key', input.key);
      assertRequiredString('label', input.label);

      const existing = await client.customFieldDefinition.findFirst({
        where: { organizationId, key: input.key },
      });
      if (existing) {
        throw new Error(
          `customFieldDefinitionRepository: a custom field with key "${input.key}" already exists for organization "${organizationId}".`
        );
      }

      const order = await client.customFieldDefinition.count({ where: { organizationId } });

      return client.customFieldDefinition.create({
        data: {
          organizationId,
          order,
          ...mapCustomFieldInputForCreate(input),
        },
      });
    },

    async setCustomFieldDefinitionStatus(id, organizationId, status) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);

      return client.customFieldDefinition.update({ where: { id }, data: { status } });
    },
  };
}

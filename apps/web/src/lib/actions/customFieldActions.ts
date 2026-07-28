'use server';

/**
 * Server Actions for Custom Field Definitions and Values (P013B - see
 * docs/ROADMAP.md). Same pattern as entityActions.ts: requirePermission ->
 * getOrganizationContext -> repository -> recordAudit ->
 * CustomFieldDefinitionChanged after commit -> revalidatePath. Values are
 * validated with `validateCustomFieldValue` (reused unchanged from
 * `@nera/customization-engine`) before ever reaching the repository.
 */

import { revalidatePath } from 'next/cache';
import { createOrganizationEngine } from '@nera/organization-engine';
import { createAuditEngine } from '@nera/audit-engine';
import { eventBus } from '@nera/event-bus-engine';
import {
  createCustomFieldDefinitionRepository,
  createCustomFieldValueRepository,
  validateCustomFieldValue,
  type CustomFieldDefinition,
  type CustomFieldStatus,
  type CustomFieldValue,
  type CustomFieldValueData,
  type NewCustomFieldInput,
} from '@nera/customization-engine';
import { DEMO_MEMBERSHIP_ID, DEMO_USER_PROFILE_ID } from '@/src/lib/auth/demoIdentity';
import type { ActionResult } from './entityActions';
import { requirePermission } from './requirePermission';

const { getOrganizationContext } = createOrganizationEngine();

function toCustomFieldDefinitionDomain(record: {
  id: string;
  key: string;
  label: string;
  description: string | null;
  helpText: string | null;
  fieldType: string;
  targetScope: string;
  targetEntityType: string | null;
  targetRoleKey: string | null;
  targetModuleId: string | null;
  required: boolean;
  defaultValue: unknown;
  validation: unknown;
  options: unknown;
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
}): CustomFieldDefinition {
  return {
    id: record.id,
    key: record.key,
    label: record.label,
    description: record.description ?? undefined,
    helpText: record.helpText ?? undefined,
    fieldType: record.fieldType as CustomFieldDefinition['fieldType'],
    targetScope: record.targetScope as CustomFieldDefinition['targetScope'],
    targetEntityType: (record.targetEntityType ?? undefined) as
      CustomFieldDefinition['targetEntityType'] | undefined,
    targetRoleKey: record.targetRoleKey ?? undefined,
    targetModuleId: record.targetModuleId ?? undefined,
    // No institutionId: never persisted (Owner decision 3, P013B) - see
    // customFieldDefinitionRepository.ts.
    required: record.required,
    defaultValue: (record.defaultValue ?? undefined) as CustomFieldDefinition['defaultValue'],
    validation: (record.validation ?? undefined) as CustomFieldDefinition['validation'],
    options: (record.options ?? undefined) as CustomFieldDefinition['options'],
    showInList: record.showInList,
    showInDetail: record.showInDetail,
    filterable: record.filterable,
    searchable: record.searchable,
    includeInExcelExport: record.includeInExcelExport,
    includeInExcelImport: record.includeInExcelImport,
    viewPermission: record.viewPermission ?? undefined,
    editPermission: record.editPermission ?? undefined,
    order: record.order,
    section: record.section ?? undefined,
    status: record.status as CustomFieldStatus,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

function toCustomFieldValueDomain(record: {
  id: string;
  customFieldDefinitionId: string;
  entityId: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId: string;
}): CustomFieldValue {
  return {
    id: record.id,
    customFieldDefinitionId: record.customFieldDefinitionId,
    entityId: record.entityId,
    value: record.value as CustomFieldValueData,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    updatedByUserId: record.updatedByUserId,
  };
}

export type LoadedCustomFieldData = {
  definitions: CustomFieldDefinition[];
  values: CustomFieldValue[];
};

/** Bulk read (mirrors listEntitiesAction's convention) - list/export screens need every entity's values at once, not just one entity's card. */
export async function listCustomFieldDefinitionsAction(
  organizationId: string
): Promise<ActionResult<LoadedCustomFieldData>> {
  const [definitionRecords, valueRecords] = await getOrganizationContext(
    { organizationId },
    async tx => {
      const definitionRepo = createCustomFieldDefinitionRepository(tx);
      const valueRepo = createCustomFieldValueRepository(tx);
      return Promise.all([
        definitionRepo.listCustomFieldDefinitions(organizationId),
        valueRepo.listValuesForOrganization(organizationId),
      ]);
    }
  );
  return {
    ok: true,
    data: {
      definitions: definitionRecords.map(toCustomFieldDefinitionDomain),
      values: valueRecords.map(toCustomFieldValueDomain),
    },
  };
}

export async function createCustomFieldDefinitionAction(
  organizationId: string,
  input: NewCustomFieldInput
): Promise<ActionResult<CustomFieldDefinition>> {
  const denyReason = await requirePermission(organizationId, 'custom_fields.manage');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const created = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createCustomFieldDefinitionRepository(tx);
      const audit = createAuditEngine(tx);
      const record = await repo.createCustomFieldDefinition(organizationId, input);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'custom_field_definition.created',
        entityType: 'custom_field_definition',
        entityId: record.id,
        newValues: { key: record.key, label: record.label },
      });
      return record;
    });

    await eventBus.publish({
      eventType: 'CustomFieldDefinitionChanged',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { customFieldDefinitionId: created.id, changeType: 'created' },
    });

    revalidatePath('/settings');
    return { ok: true, data: toCustomFieldDefinitionDomain(created) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function setCustomFieldDefinitionStatusAction(
  organizationId: string,
  id: string,
  status: CustomFieldStatus
): Promise<ActionResult<CustomFieldDefinition>> {
  const denyReason = await requirePermission(organizationId, 'custom_fields.manage');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const updated = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createCustomFieldDefinitionRepository(tx);
      const audit = createAuditEngine(tx);
      const record = await repo.setCustomFieldDefinitionStatus(id, organizationId, status);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'custom_field_definition.status_changed',
        entityType: 'custom_field_definition',
        entityId: id,
        newValues: { status },
      });
      return record;
    });

    await eventBus.publish({
      eventType: 'CustomFieldDefinitionChanged',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { customFieldDefinitionId: id, changeType: 'status_changed' },
    });

    revalidatePath('/settings');
    return { ok: true, data: toCustomFieldDefinitionDomain(updated) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function listCustomFieldValuesForEntityAction(
  organizationId: string,
  entityId: string
): Promise<ActionResult<CustomFieldValue[]>> {
  const records = await getOrganizationContext({ organizationId }, async tx => {
    const repo = createCustomFieldValueRepository(tx);
    return repo.listValuesForEntity(entityId);
  });
  return { ok: true, data: records.map(toCustomFieldValueDomain) };
}

export async function setCustomFieldValueAction(
  organizationId: string,
  entityId: string,
  customFieldDefinitionId: string,
  value: CustomFieldValueData,
  updatedByUserId: string
): Promise<ActionResult<CustomFieldValue>> {
  const denyReason = await requirePermission(organizationId, 'custom_fields.manage');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  type SetValueResult =
    | {
        ok: true;
        record: Awaited<
          ReturnType<ReturnType<typeof createCustomFieldValueRepository>['setValue']>
        >;
      }
    | { ok: false; errors: string[] };

  const result = await getOrganizationContext<SetValueResult>({ organizationId }, async tx => {
    const definitionRepo = createCustomFieldDefinitionRepository(tx);
    const definitions = await definitionRepo.listCustomFieldDefinitions(organizationId);
    const definition = definitions.find(entry => entry.id === customFieldDefinitionId);
    if (!definition) {
      return { ok: false, errors: ['שדה מותאם אישית לא נמצא.'] };
    }

    const errors = validateCustomFieldValue(toCustomFieldDefinitionDomain(definition), value);
    if (errors.length > 0) {
      return { ok: false, errors };
    }

    const valueRepo = createCustomFieldValueRepository(tx);
    const audit = createAuditEngine(tx);
    const record = await valueRepo.setValue({
      organizationId,
      entityId,
      customFieldDefinitionId,
      value,
      updatedByUserId,
    });
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'custom_field_value.set',
      entityType: 'custom_field_value',
      entityId: record.id,
      newValues: { customFieldDefinitionId, value },
    });
    return { ok: true, record };
  });

  if (!result.ok) {
    return { ok: false, reason: result.errors.join(' ') };
  }

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: toCustomFieldValueDomain(result.record) };
}

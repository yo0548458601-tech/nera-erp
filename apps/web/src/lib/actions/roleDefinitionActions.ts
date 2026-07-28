'use server';

/**
 * Server Actions for Role Definitions (P013B - see docs/ROADMAP.md). Same
 * pattern as entityActions.ts: requirePermission -> getOrganizationContext
 * (real transaction, shared by the repository call and the audit write) ->
 * repository call -> recordAudit -> publish RoleDefinitionChanged after
 * commit -> revalidatePath.
 */

import { revalidatePath } from 'next/cache';
import { createOrganizationEngine } from '@nera/organization-engine';
import { createAuditEngine } from '@nera/audit-engine';
import { eventBus } from '@nera/event-bus-engine';
import {
  createRoleDefinitionRepository,
  type NewRoleDefinitionInput,
  type RoleDefinition,
  type RoleDefinitionPatch,
  type RoleDefinitionStatus,
} from '@nera/entity-engine';
import { DEMO_MEMBERSHIP_ID, DEMO_USER_PROFILE_ID } from '@/src/lib/auth/demoIdentity';
import type { ActionResult } from './entityActions';
import { requirePermission } from './requirePermission';

const { getOrganizationContext } = createOrganizationEngine();

function toRoleDefinitionDomain(record: {
  id: string;
  key: string;
  label: string;
  description: string;
  applicableEntityTypes: RoleDefinition['applicableEntityTypes'];
  status: RoleDefinitionStatus;
  order: number;
  icon: string | null;
  showInGlobalAddNew: boolean;
  allowMultipleAssignments: boolean;
  supportsDateRange: boolean;
  supportsBillingProfile: boolean;
  requiredPermissions: unknown;
  linkedCustomFieldDefinitionIds: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): RoleDefinition {
  return {
    id: record.id,
    key: record.key,
    label: record.label,
    description: record.description,
    applicableEntityTypes: record.applicableEntityTypes,
    // No institutionId: never persisted (Owner decision 3, P013B) - see
    // roleDefinitionRepository.ts.
    status: record.status,
    order: record.order,
    icon: record.icon ?? undefined,
    showInGlobalAddNew: record.showInGlobalAddNew,
    allowMultipleAssignments: record.allowMultipleAssignments,
    supportsDateRange: record.supportsDateRange,
    supportsBillingProfile: record.supportsBillingProfile,
    requiredPermissions: (record.requiredPermissions ??
      {}) as RoleDefinition['requiredPermissions'],
    linkedCustomFieldDefinitionIds: record.linkedCustomFieldDefinitionIds,
    isSystem: record.isSystem,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

export async function listRoleDefinitionsAction(
  organizationId: string
): Promise<ActionResult<RoleDefinition[]>> {
  const records = await getOrganizationContext({ organizationId }, async tx => {
    const repo = createRoleDefinitionRepository(tx);
    return repo.listRoleDefinitions(organizationId);
  });
  return { ok: true, data: records.map(toRoleDefinitionDomain) };
}

export async function createRoleDefinitionAction(
  organizationId: string,
  input: NewRoleDefinitionInput
): Promise<ActionResult<RoleDefinition>> {
  const denyReason = await requirePermission(organizationId, 'roles.manage_definitions');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const created = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createRoleDefinitionRepository(tx);
      const audit = createAuditEngine(tx);
      const record = await repo.createRoleDefinition(organizationId, input);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'role_definition.created',
        entityType: 'role_definition',
        entityId: record.id,
        newValues: { key: record.key, label: record.label },
      });
      return record;
    });

    await eventBus.publish({
      eventType: 'RoleDefinitionChanged',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { roleDefinitionId: created.id, changeType: 'created' },
    });

    revalidatePath('/settings');
    return { ok: true, data: toRoleDefinitionDomain(created) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function updateRoleDefinitionAction(
  organizationId: string,
  id: string,
  patch: RoleDefinitionPatch
): Promise<ActionResult<RoleDefinition>> {
  const denyReason = await requirePermission(organizationId, 'roles.manage_definitions');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const updated = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createRoleDefinitionRepository(tx);
      const audit = createAuditEngine(tx);
      const record = await repo.updateRoleDefinition(id, organizationId, patch);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'role_definition.updated',
        entityType: 'role_definition',
        entityId: id,
        newValues: patch,
      });
      return record;
    });

    await eventBus.publish({
      eventType: 'RoleDefinitionChanged',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { roleDefinitionId: id, changeType: 'updated' },
    });

    revalidatePath('/settings');
    return { ok: true, data: toRoleDefinitionDomain(updated) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function setRoleDefinitionStatusAction(
  organizationId: string,
  id: string,
  status: RoleDefinitionStatus
): Promise<ActionResult<RoleDefinition>> {
  const denyReason = await requirePermission(organizationId, 'roles.manage_definitions');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const updated = await getOrganizationContext({ organizationId }, async tx => {
      const repo = createRoleDefinitionRepository(tx);
      const audit = createAuditEngine(tx);
      const record = await repo.setRoleDefinitionStatus(id, organizationId, status);
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'role_definition.status_changed',
        entityType: 'role_definition',
        entityId: id,
        newValues: { status },
      });
      return record;
    });

    await eventBus.publish({
      eventType: 'RoleDefinitionChanged',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { roleDefinitionId: id, changeType: 'status_changed' },
    });

    revalidatePath('/settings');
    return { ok: true, data: toRoleDefinitionDomain(updated) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

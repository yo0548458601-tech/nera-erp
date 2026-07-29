'use server';

/**
 * Server Actions for Field Requirement Rules (P013B - see
 * docs/ROADMAP.md). Same pattern as entityActions.ts: requirePermission ->
 * getOrganizationContext -> repository -> recordAudit ->
 * FieldRequirementRuleChanged after commit -> revalidatePath.
 */

import { revalidatePath } from 'next/cache';
import { createOrganizationEngine } from '@nera/organization-engine';
import { createAuditEngine } from '@nera/audit-engine';
import { eventBus } from '@nera/event-bus-engine';
import {
  createFieldRequirementRuleRepository,
  type FieldRequirementMode,
  type FieldRequirementRule,
  type FieldRequirementScope,
} from '@nera/customization-engine';
import { DEMO_MEMBERSHIP_ID, DEMO_USER_PROFILE_ID } from '@/src/lib/auth/demoIdentity';
import type { ActionResult } from './entityActions';
import { requirePermission } from './requirePermission';

const { getOrganizationContext } = createOrganizationEngine();

function toFieldRequirementRuleDomain(record: {
  id: string;
  fieldKey: string;
  scope: FieldRequirementScope;
  targetId: string;
  mode: FieldRequirementMode;
  updatedByUserId: string | null;
  updatedAt: Date;
}): FieldRequirementRule {
  return {
    id: record.id,
    fieldKey: record.fieldKey,
    scope: record.scope,
    targetId: record.targetId,
    mode: record.mode,
    updatedAt: record.updatedAt.toISOString(),
    updatedByUserId: record.updatedByUserId ?? undefined,
  };
}

export async function listFieldRequirementRulesAction(
  organizationId: string
): Promise<ActionResult<FieldRequirementRule[]>> {
  const records = await getOrganizationContext({ organizationId }, async tx => {
    const repo = createFieldRequirementRuleRepository(tx);
    return repo.listRulesForOrganization(organizationId);
  });
  return { ok: true, data: records.map(toFieldRequirementRuleDomain) };
}

export async function setFieldRequirementRuleAction(
  organizationId: string,
  fieldKey: string,
  scope: FieldRequirementScope,
  targetId: string,
  mode: FieldRequirementMode,
  updatedByUserId: string
): Promise<ActionResult<FieldRequirementRule>> {
  const denyReason = await requirePermission(organizationId, 'field_requirements.manage_defaults');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  const updated = await getOrganizationContext({ organizationId }, async tx => {
    const repo = createFieldRequirementRuleRepository(tx);
    const audit = createAuditEngine(tx);
    const record = await repo.setRule({
      organizationId,
      fieldKey,
      scope,
      targetId,
      mode,
      updatedByUserId,
    });
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'field_requirement_rule.set',
      entityType: 'field_requirement_rule',
      entityId: record.id,
      newValues: { fieldKey, scope, targetId, mode },
    });
    return record;
  });

  await eventBus.publish({
    eventType: 'FieldRequirementRuleChanged',
    organizationId,
    actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
    payload: { fieldRequirementRuleId: updated.id, fieldKey, scope, targetId },
  });

  revalidatePath('/settings');
  return { ok: true, data: toFieldRequirementRuleDomain(updated) };
}

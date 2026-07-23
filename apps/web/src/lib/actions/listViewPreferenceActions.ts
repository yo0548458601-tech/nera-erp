'use server';

/**
 * Server Actions for list-view column preferences (P013A - Owner decision:
 * List View Preferences persist in P013A, unlike Custom Fields/Field
 * Requirements). Same pattern as entityActions.ts: checkPermission (for
 * writes only - reads use the same resolution cascade every session
 * already relies on) -> getOrganizationContext -> repository -> audit.
 */

import { revalidatePath } from 'next/cache';
import { createOrganizationEngine } from '@nera/organization-engine';
import { createAuditEngine } from '@nera/audit-engine';
import {
  createListViewPreferenceRepository,
  type EffectiveListViewColumns,
} from '@nera/entity-engine';
import type { ListViewPreferenceScope } from '@nera/database';
import { DEMO_MEMBERSHIP_ID, DEMO_USER_PROFILE_ID } from '@/src/lib/auth/demoIdentity';
import type { ActionResult } from './entityActions';
import { requirePermission } from './requirePermission';

const { getOrganizationContext } = createOrganizationEngine();

export async function getEffectiveListViewColumnsAction(
  organizationId: string,
  screenId: string,
  roleIds: string[],
  institutionId: string | undefined,
  builtInDefaultColumnKeys: string[]
): Promise<EffectiveListViewColumns> {
  return getOrganizationContext({ organizationId }, async tx => {
    const repo = createListViewPreferenceRepository(tx);
    return repo.getEffectivePreference(
      screenId,
      { organizationId, userId: DEMO_USER_PROFILE_ID, roleIds, institutionId },
      builtInDefaultColumnKeys
    );
  });
}

export async function setMyListViewColumnsAction(
  organizationId: string,
  screenId: string,
  visibleColumnKeys: string[]
): Promise<ActionResult<null>> {
  // A user setting their OWN column preference is always allowed - this
  // permission gates setting *defaults* (system/role/institution scope) for
  // OTHER users, not one's own view. No check needed for 'user' scope.

  await getOrganizationContext({ organizationId }, async tx => {
    const repo = createListViewPreferenceRepository(tx);
    const audit = createAuditEngine(tx);
    await repo.setPreference({
      organizationId,
      scope: 'user',
      targetId: DEMO_USER_PROFILE_ID,
      screenId,
      visibleColumnKeys,
    });
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'list_view_preference.updated',
      entityType: 'list_view_column_preference',
      entityId: `${screenId}:user:${DEMO_USER_PROFILE_ID}`,
      newValues: { visibleColumnKeys },
    });
  });

  revalidatePath('/contacts');
  return { ok: true, data: null };
}

export async function resetMyListViewColumnsAction(
  organizationId: string,
  screenId: string
): Promise<ActionResult<null>> {
  await getOrganizationContext({ organizationId }, async tx => {
    const repo = createListViewPreferenceRepository(tx);
    await repo.resetPreference({
      organizationId,
      scope: 'user',
      targetId: DEMO_USER_PROFILE_ID,
      screenId,
    });
  });

  revalidatePath('/contacts');
  return { ok: true, data: null };
}

export async function setSystemDefaultListViewColumnsAction(
  organizationId: string,
  screenId: string,
  visibleColumnKeys: string[]
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'list_views.manage_defaults');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const repo = createListViewPreferenceRepository(tx);
    const audit = createAuditEngine(tx);
    await repo.setPreference({
      organizationId,
      scope: 'system' as ListViewPreferenceScope,
      screenId,
      visibleColumnKeys,
    });
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'list_view_preference.updated',
      entityType: 'list_view_column_preference',
      entityId: `${screenId}:system`,
      newValues: { visibleColumnKeys },
    });
  });

  revalidatePath('/contacts');
  return { ok: true, data: null };
}

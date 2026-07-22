import {
  createAuthorizationEngine,
  type CheckPermissionInput,
} from '@nera/authorization-engine/src/checkPermission';
import { createOrganizationEngine } from '@nera/organization-engine';
import { DEMO_MEMBERSHIP_ID, DEMO_USER_PROFILE_ID } from '@/src/lib/auth/demoIdentity';

const { getOrganizationContext } = createOrganizationEngine();

/**
 * Verified P013A bug fix (see the implementation report): `checkPermission`'s
 * own queries (`organization_memberships`, `membership_roles`, `permissions`,
 * `role_permissions`) are FORCE-RLS tables, and its default client
 * (`appPrisma`, the least-privilege `nera_app_role` connection) cannot bypass
 * RLS. Calling it with no `app.current_organization_id` session variable set
 * - which is exactly what happened when this ran as a plain pre-check outside
 * any transaction - makes every one of those queries return zero rows, so
 * `checkPermission` reports a clean, non-throwing `deny`/`'unknown-membership'`
 * regardless of the actor's real, seeded membership. This is not a
 * permission-logic bug - `checkPermission` behaves exactly as designed for
 * the connection it was given; the bug was calling it without the RLS
 * context `getOrganizationContext` exists to establish.
 *
 * Kept as its own module (not inlined per Server Action file) so both
 * `entityActions.ts` and `listViewPreferenceActions.ts` share exactly one
 * fixed implementation, rather than two copies that could drift.
 */
export async function requirePermission(
  organizationId: string,
  permission: CheckPermissionInput['permission']
): Promise<string | null> {
  return getOrganizationContext({ organizationId }, async tx => {
    const { checkPermission } = createAuthorizationEngine(tx);
    const decision = await checkPermission({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      permission,
    });
    return decision.decision === 'allow' ? null : decision.reason;
  });
}

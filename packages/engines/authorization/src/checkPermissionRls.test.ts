import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma, appPrisma, type Prisma } from '@nera/database';
import { createAuthorizationEngine } from './checkPermission';

/**
 * A minimal, local stand-in for `@nera/organization-engine`'s
 * `getOrganizationContext` - deliberately not imported from that package,
 * since this test file's only purpose is proving the RLS-context
 * requirement in isolation, not exercising the real organization engine
 * (which `@nera/authorization-engine` does not otherwise depend on -
 * see this package's `package.json`). Same three lines that function's
 * real implementation does: open a transaction, set the session variable
 * RLS policies read, run the callback.
 */
async function withOrganizationContext<T>(
  organizationId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return appPrisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
    return work(tx);
  });
}

/**
 * Regression test for a verified P013A production bug (see the
 * implementation report): `checkPermission()` defaults to `appPrisma`, the
 * least-privilege `nera_app_role` connection, which cannot bypass Row Level
 * Security. Its own queries (`organization_memberships`, `membership_roles`,
 * `permissions`, `role_permissions`) are FORCE-RLS tables - calling
 * `checkPermission` on a connection with no `app.current_organization_id`
 * session variable set makes every one of those queries return zero rows,
 * so it reports a clean, non-throwing `deny`/`'unknown-membership'` for a
 * real, active, correctly-seeded membership. This is not a permission-logic
 * bug: `checkPermission` behaves exactly as designed for the connection it
 * is given. The bug was ever calling it *outside* the RLS-scoped
 * transaction `getOrganizationContext` establishes - which is exactly what
 * every `apps/web` Server Action did before this fix (see
 * `apps/web/src/lib/actions/requirePermission.ts`).
 *
 * Requires a real PostgreSQL connection with the P013A migration applied,
 * both roles bootstrapped, and the database seeded (real
 * UserProfile/OrganizationMembership/MembershipRole rows) - see
 * packages/database/README.md.
 */
describe('checkPermission + RLS interaction (requires PostgreSQL, requires seed.ts to have run)', () => {
  const ORG_ID = '00000000-0000-0000-0000-000000000000';
  const USER_ID = '22222222-2222-2222-2222-222222222222';
  const MEMBERSHIP_ID = '33333333-3333-3333-3333-333333333333';

  it('denies with "unknown-membership" when appPrisma is used with no RLS context set - the exact bug', async () => {
    const { checkPermission } = createAuthorizationEngine(appPrisma);

    const decision = await checkPermission({
      organizationId: ORG_ID,
      actor: { userProfileId: USER_ID, membershipId: MEMBERSHIP_ID },
      permission: 'entities.edit',
    });

    expect(decision).toEqual({
      permission: 'entities.edit',
      decision: 'deny',
      reason: 'unknown-membership',
    });
  });

  it('allows the same real, seeded membership once checkPermission runs inside getOrganizationContext - the fix', async () => {
    const decision = await withOrganizationContext(ORG_ID, async tx => {
      const { checkPermission } = createAuthorizationEngine(tx);
      return checkPermission({
        organizationId: ORG_ID,
        actor: { userProfileId: USER_ID, membershipId: MEMBERSHIP_ID },
        permission: 'entities.edit',
      });
    });

    expect(decision.decision).toBe('allow');
  });

  it('the administrative prisma client bypasses RLS regardless (table owner) - a real deny would signal a genuinely broken seed, not this bug', async () => {
    const { checkPermission } = createAuthorizationEngine(prisma);

    const decision = await checkPermission({
      organizationId: ORG_ID,
      actor: { userProfileId: USER_ID, membershipId: MEMBERSHIP_ID },
      permission: 'entities.edit',
    });

    expect(decision.decision).toBe('allow');
  });

  it('a genuinely unknown membership is still denied correctly inside getOrganizationContext - the fix does not mask real denials', async () => {
    const decision = await withOrganizationContext(ORG_ID, async tx => {
      const { checkPermission } = createAuthorizationEngine(tx);
      return checkPermission({
        organizationId: ORG_ID,
        actor: { userProfileId: randomUUID(), membershipId: randomUUID() },
        permission: 'entities.edit',
      });
    });

    expect(decision).toEqual({
      permission: 'entities.edit',
      decision: 'deny',
      reason: 'unknown-membership',
    });
  });
});

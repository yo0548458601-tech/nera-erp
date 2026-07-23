import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { appPrisma, prisma } from '@nera/database';
import {
  createGetOrganizationContext,
  type OrganizationContextDbClient,
} from './organizationContext';
import { createOrganizationEngine } from './index';
import { asRestrictedRole } from './testSupport/restrictedRole';

/**
 * A bare fake with no default behavior - used only for construction/
 * validation tests, where the exact call sequence is being asserted, never
 * for behavioral RLS proof (that requires a real Postgres connection - see
 * the "behavioral RLS isolation" describe block below, which needs
 * `npm run db:migrate:deploy` and `npm run db:bootstrap-rls-role`, both
 * documented in `packages/database/README.md`, to have been run against
 * DATABASE_URL first).
 */
type FakeOrganizationContextDbClient = OrganizationContextDbClient & {
  $transaction: ReturnType<typeof vi.fn>;
};

function createFakeClient(): FakeOrganizationContextDbClient {
  return { $transaction: vi.fn() } as unknown as FakeOrganizationContextDbClient;
}

async function createTestOrganization(name: string): Promise<string> {
  const organization = await prisma.organization.create({
    data: { id: randomUUID(), name },
  });
  return organization.id;
}

describe('createGetOrganizationContext', () => {
  it('does not connect to or query the database at construction time', () => {
    const fake = createFakeClient();

    expect(() => createGetOrganizationContext(fake)).not.toThrow();
    expect(fake.$transaction).not.toHaveBeenCalled();
  });

  it('defaults to appPrisma, the least-privilege application client (P013A) - never the administrative prisma client - when no client is injected', () => {
    expect(() => createGetOrganizationContext()).not.toThrow();
    expect(appPrisma).not.toBe(prisma);
  });

  describe('input validation', () => {
    it('rejects a missing organizationId without opening a transaction', async () => {
      const fake = createFakeClient();
      const getOrganizationContext = createGetOrganizationContext(fake);

      await expect(
        getOrganizationContext(
          { organizationId: undefined as unknown as string },
          async () => undefined
        )
      ).rejects.toThrow(/organizationId/);
      expect(fake.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an empty-string organizationId without opening a transaction', async () => {
      const fake = createFakeClient();
      const getOrganizationContext = createGetOrganizationContext(fake);

      await expect(
        getOrganizationContext({ organizationId: '   ' }, async () => undefined)
      ).rejects.toThrow(/organizationId/);
      expect(fake.$transaction).not.toHaveBeenCalled();
    });

    /**
     * Verified P013A production bug: a stale, non-persisted demo
     * organization id (`org-jerusalem`/`org-bnei-brak` in
     * `apps/web/src/lib/auth/demoData.ts` - never backed by a real
     * `Organization` row) reached this function and, from there, whichever
     * repository query ran first, surfacing as a raw Postgres/Prisma error
     * ("Error creating UUID, invalid character...") instead of a clear,
     * actionable one. This is the single choke point every real call site
     * goes through, so validating the UUID shape here catches every future
     * instance of this same mistake, not just this one.
     */
    it('rejects a non-UUID organizationId (e.g. a stale placeholder id) without opening a transaction', async () => {
      const fake = createFakeClient();
      const getOrganizationContext = createGetOrganizationContext(fake);

      await expect(
        getOrganizationContext({ organizationId: 'org-bnei-brak' }, async () => undefined)
      ).rejects.toThrow(/must be a valid UUID/);
      expect(fake.$transaction).not.toHaveBeenCalled();
    });

    it('accepts a well-formed UUID organizationId', async () => {
      const fake = createFakeClient();
      fake.$transaction.mockResolvedValue('ok');
      const getOrganizationContext = createGetOrganizationContext(fake);

      await expect(
        getOrganizationContext({ organizationId: randomUUID() }, async () => 'ok')
      ).resolves.toBe('ok');
      expect(fake.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('database error handling', () => {
    it('propagates a database error from $transaction without swallowing or converting it', async () => {
      const originalError = new Error('connection refused');
      const fake = createFakeClient();
      fake.$transaction.mockRejectedValue(originalError);
      const getOrganizationContext = createGetOrganizationContext(fake);

      await expect(
        getOrganizationContext({ organizationId: randomUUID() }, async () => undefined)
      ).rejects.toBe(originalError);
    });

    it('propagates an error thrown by work() unchanged', async () => {
      const originalError = new Error('work failed');
      const fake = createFakeClient();
      const fakeTx = { $queryRaw: vi.fn().mockResolvedValue([]) };
      fake.$transaction.mockImplementation(async fn => fn(fakeTx as never));
      const getOrganizationContext = createGetOrganizationContext(fake);

      await expect(
        getOrganizationContext({ organizationId: randomUUID() }, async () => {
          throw originalError;
        })
      ).rejects.toBe(originalError);
    });
  });

  it('exposes exactly getOrganizationContext and assertInstitutionBelongsToOrganization', () => {
    const engine = createOrganizationEngine(createFakeClient() as never);
    expect(Object.keys(engine).sort()).toEqual(
      ['assertInstitutionBelongsToOrganization', 'getOrganizationContext'].sort()
    );
  });
});

/**
 * Behavioral RLS tests - the honest way to prove Row Level Security is
 * enforced, which cannot be faked. Requires a real PostgreSQL connection via
 * DATABASE_URL, with the P012 migration applied and the RLS test role
 * bootstrapped (see packages/database/README.md). These are the tests that
 * cannot be executed in an environment without a reachable database - see
 * the P012 implementation report for what could and could not be verified
 * directly.
 *
 * Explicitly injected with `prisma` (the administrative, table-owner
 * client), not the default `appPrisma` (P013A) - `asRestrictedRole`'s
 * `SET LOCAL ROLE` mechanism requires the connection to already be a
 * superuser or a member of `nera_rls_test_role`, which the least-privilege
 * `nera_app_role` deliberately is not. This is exactly the "explicit choice
 * only when elevated administrative privileges are actually needed" case.
 */
describe('getOrganizationContext (behavioral RLS isolation, requires PostgreSQL)', () => {
  const engine = createOrganizationEngine(prisma);

  it('sets app.current_organization_id for the duration of the transaction', async () => {
    const organizationId = await createTestOrganization('Org A - session var check');

    const value = await engine.getOrganizationContext(
      { organizationId },
      asRestrictedRole(async tx => {
        const rows = await tx.$queryRaw<
          Array<{ current_org: string }>
        >`SELECT current_setting('app.current_organization_id', true) AS current_org`;
        return rows[0]?.current_org;
      })
    );

    expect(value).toBe(organizationId);
  });

  it('allows an organization to see its own data', async () => {
    const organizationId = await createTestOrganization('Org A - own data visible');

    const rows = await engine.getOrganizationContext(
      { organizationId },
      asRestrictedRole(async tx => tx.organization.findMany({ where: { id: organizationId } }))
    );

    expect(rows).toHaveLength(1);
  });

  it("never sees another organization's data - cross-organization isolation", async () => {
    const organizationAId = await createTestOrganization('Org A - isolation');
    await createTestOrganization('Org B - isolation');

    const visibleToA = await engine.getOrganizationContext(
      { organizationId: organizationAId },
      asRestrictedRole(async tx => tx.organization.findMany())
    );

    expect(visibleToA.map(org => org.id)).toEqual([organizationAId]);
  });

  it('institutions are isolated the same way organizations are', async () => {
    const organizationAId = await createTestOrganization('Org A - institution isolation');
    const organizationBId = await createTestOrganization('Org B - institution isolation');
    await prisma.institution.create({
      data: { id: randomUUID(), organizationId: organizationAId, name: 'Institution A' },
    });
    await prisma.institution.create({
      data: { id: randomUUID(), organizationId: organizationBId, name: 'Institution B' },
    });

    const visibleToA = await engine.getOrganizationContext(
      { organizationId: organizationAId },
      asRestrictedRole(async tx =>
        tx.institution.findMany({
          where: { organizationId: { in: [organizationAId, organizationBId] } },
        })
      )
    );

    expect(visibleToA).toHaveLength(1);
    expect(visibleToA[0]?.organizationId).toBe(organizationAId);
  });

  it('reverts the role and session context after a successful commit', async () => {
    const organizationId = await createTestOrganization('Org A - revert on commit');

    await engine.getOrganizationContext(
      { organizationId },
      asRestrictedRole(async tx => tx.organization.findMany({ where: { id: organizationId } }))
    );

    // A fresh, unwrapped transaction must see neither a lingering role nor a
    // lingering session variable from the call above.
    const [role] = await prisma.$queryRaw<
      Array<{ active_role: string }>
    >`SELECT current_user AS active_role`;
    expect(role?.active_role).not.toBe('nera_rls_test_role');
    const [org] = await prisma.$queryRaw<
      Array<{ current_org: string | null }>
    >`SELECT current_setting('app.current_organization_id', true) AS current_org`;
    expect(org?.current_org).not.toBe(organizationId);
  });

  it('reverts the role and session context even when work() throws (rollback)', async () => {
    const organizationId = await createTestOrganization('Org A - revert on rollback');

    await expect(
      engine.getOrganizationContext(
        { organizationId },
        asRestrictedRole(async () => {
          throw new Error('deliberate failure to force a rollback');
        })
      )
    ).rejects.toThrow('deliberate failure to force a rollback');

    const [role] = await prisma.$queryRaw<
      Array<{ active_role: string }>
    >`SELECT current_user AS active_role`;
    expect(role?.active_role).not.toBe('nera_rls_test_role');
  });

  it(
    'documents that RLS does not protect the unwrapped (table-owner/superuser) connection - ' +
      'forgetting asRestrictedRole fails the isolation assertion instead of silently passing',
    async () => {
      const organizationAId = await createTestOrganization('Org A - no wrapper');
      const organizationBId = await createTestOrganization('Org B - no wrapper');

      // Deliberately NOT wrapped in asRestrictedRole.
      const visibleToA = await engine.getOrganizationContext(
        { organizationId: organizationAId },
        async tx =>
          tx.organization.findMany({ where: { id: { in: [organizationAId, organizationBId] } } })
      );

      // Without the role switch, RLS is not enforced against the connecting
      // (table-owner) role even though FORCE ROW LEVEL SECURITY is set - this
      // is the exact reason the restricted role and asRestrictedRole exist.
      expect(visibleToA.map(org => org.id).sort()).toEqual(
        [organizationAId, organizationBId].sort()
      );
    }
  );
});

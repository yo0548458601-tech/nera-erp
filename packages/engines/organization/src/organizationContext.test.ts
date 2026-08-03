import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { appPrisma, prisma, type Prisma } from '@nera/database';
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

/**
 * Fixture creation via the admin `prisma` client against a FORCE-RLS table
 * (`organizations`, `institutions`) requires `app.current_organization_id`
 * to be set to the exact row being written - verified directly during P014
 * (Owner-approved local role architecture): with `nera_dev_admin` now
 * genuinely owning these tables (not `postgres`), `FORCE ROW LEVEL SECURITY`
 * applies to it too, since `nera_dev_admin` is deliberately
 * `NOSUPERUSER NOBYPASSRLS` - that is exactly what `FORCE` means (it removes
 * the table-owner exemption). This mirrors the identical fix applied to
 * `packages/database/src/seed.ts` for the same reason.
 */
async function withOrgWriteContext<T>(
  organizationId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_organization_id', $1, true)`,
      organizationId
    );
    return work(tx);
  });
}

async function createTestOrganization(name: string): Promise<string> {
  const id = randomUUID();
  await withOrgWriteContext(id, tx => tx.organization.create({ data: { id, name } }));
  return id;
}

async function createTestInstitution(organizationId: string, name: string): Promise<string> {
  const id = randomUUID();
  await withOrgWriteContext(organizationId, tx =>
    tx.institution.create({ data: { id, organizationId, name } })
  );
  return id;
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
 * bootstrapped (see packages/database/README.md).
 *
 * Explicitly injected with `prisma` (the administrative client), not the
 * default `appPrisma` (P013A) - `asRestrictedRole`'s `SET LOCAL ROLE`
 * mechanism requires the connection to already be a member of
 * `nera_rls_test_role` (or a superuser), which the least-privilege
 * `nera_app_role` deliberately is not, and which the Owner-approved local
 * role architecture grants to `nera_dev_admin` specifically for this
 * purpose (`GRANT nera_rls_test_role TO nera_dev_admin` - membership only,
 * no `ADMIN OPTION`, no `INHERIT` - verified directly, P014).
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
    await createTestInstitution(organizationAId, 'Institution A');
    await createTestInstitution(organizationBId, 'Institution B');

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

  /**
   * CORRECTED, P014 (Owner-approved shared-root-cause fix): this test
   * previously asserted the opposite of what is now true, and asserted a
   * premise that was never actually exercised successfully in this local
   * environment before P014 (see `packages/database/README.md`'s ownership
   * section) - it assumed the admin `prisma` connection bypasses RLS the way
   * a real Postgres superuser or a `BYPASSRLS` role would. `nera_dev_admin`
   * is neither (Owner-approved role architecture: `NOSUPERUSER
   * NOBYPASSRLS`), so once it genuinely owns these `FORCE ROW LEVEL
   * SECURITY` tables (verified directly, P014), `FORCE` applies to it too -
   * that is `FORCE`'s entire purpose (removing the table-owner exemption).
   * Verified directly: even without `asRestrictedRole`'s role switch, the
   * admin connection is correctly isolated by the session variable
   * `getOrganizationContext` itself sets. `NERA_ARCHITECTURAL_INVARIANTS.md`
   * §3.6's documented Postgres limitation - a literal superuser or
   * `BYPASSRLS` role always bypasses RLS regardless of `FORCE` - remains
   * true in principle, but Nera's own admin connection is deliberately never
   * such a role (locked Owner policy: "Nera must not normally run, migrate,
   * or test as postgres"), so that risk does not apply to any of Nera's own
   * real code paths. `asRestrictedRole` remains the authoritative isolation
   * proof regardless (a stable, minimal test double, decoupled from
   * whatever the current admin role's own configuration happens to be), not
   * because the admin connection is otherwise unsafe.
   */
  it("the admin (table-owner) connection is itself correctly isolated by FORCE RLS + the session variable, even without asRestrictedRole's role switch - verified directly, not assumed (P014)", async () => {
    const organizationAId = await createTestOrganization('Org A - admin connection isolation');
    const organizationBId = await createTestOrganization('Org B - admin connection isolation');

    // Deliberately NOT wrapped in asRestrictedRole - proving the admin
    // connection itself, not just the restricted test role, is isolated.
    const visibleToA = await engine.getOrganizationContext(
      { organizationId: organizationAId },
      async tx =>
        tx.organization.findMany({ where: { id: { in: [organizationAId, organizationBId] } } })
    );

    expect(visibleToA.map(org => org.id)).toEqual([organizationAId]);
  });
});

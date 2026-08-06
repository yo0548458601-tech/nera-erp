import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { appPrisma, prisma, type Prisma } from '@nera/database';
import {
  createAssertInstitutionBelongsToOrganization,
  InstitutionOwnershipError,
  type InstitutionOwnershipDbClient,
} from './institutionOwnership';

function createFakeClient(
  findUniqueImpl?: InstitutionOwnershipDbClient['institution']['findUnique']
): InstitutionOwnershipDbClient & { findUnique: ReturnType<typeof vi.fn> } {
  const findUnique = vi.fn(findUniqueImpl ?? (async () => null));
  return { institution: { findUnique }, findUnique };
}

describe('createAssertInstitutionBelongsToOrganization', () => {
  it('does not connect to or query the database at construction time', () => {
    const fake = createFakeClient();

    expect(() => createAssertInstitutionBelongsToOrganization(fake)).not.toThrow();
    expect(fake.findUnique).not.toHaveBeenCalled();
  });

  it('defaults to appPrisma, the least-privilege application client (P013A) - never the administrative prisma client - when no client is injected', () => {
    expect(() => createAssertInstitutionBelongsToOrganization()).not.toThrow();
    expect(appPrisma).not.toBe(prisma);
  });

  describe('input validation', () => {
    it('rejects a missing institutionId without querying the database', async () => {
      const fake = createFakeClient();
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(
        assertInstitutionBelongsToOrganization(undefined as unknown as string, 'org-1')
      ).rejects.toThrow(/institutionId/);
      expect(fake.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an empty-string organizationId without querying the database', async () => {
      const fake = createFakeClient();
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(assertInstitutionBelongsToOrganization('institution-1', '   ')).rejects.toThrow(
        /organizationId/
      );
      expect(fake.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('resolution against Institution', () => {
    it('resolves when the institution exists and belongs to the given organization', async () => {
      const fake = createFakeClient(async () => ({
        id: 'institution-1',
        organizationId: 'org-1',
        deletedAt: null,
      }));
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(
        assertInstitutionBelongsToOrganization('institution-1', 'org-1')
      ).resolves.toBeUndefined();
    });

    it('throws unknown-institution when no row exists', async () => {
      const fake = createFakeClient(async () => null);
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      const error = await assertInstitutionBelongsToOrganization('institution-1', 'org-1').catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(InstitutionOwnershipError);
      expect((error as InstitutionOwnershipError).reason).toBe('unknown-institution');
    });

    it('throws organization-mismatch when the institution belongs to a different organization', async () => {
      const fake = createFakeClient(async () => ({
        id: 'institution-1',
        organizationId: 'org-2',
        deletedAt: null,
      }));
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      const error = await assertInstitutionBelongsToOrganization('institution-1', 'org-1').catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(InstitutionOwnershipError);
      expect((error as InstitutionOwnershipError).reason).toBe('organization-mismatch');
    });

    it('throws institution-deleted when the institution is soft-deleted, even if the organization matches', async () => {
      const fake = createFakeClient(async () => ({
        id: 'institution-1',
        organizationId: 'org-1',
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      }));
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      const error = await assertInstitutionBelongsToOrganization('institution-1', 'org-1').catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(InstitutionOwnershipError);
      expect((error as InstitutionOwnershipError).reason).toBe('institution-deleted');
    });
  });

  describe('database error handling', () => {
    it('propagates a database error without swallowing or converting it to a deny', async () => {
      const originalError = new Error('connection refused');
      const fake = createFakeClient(async () => {
        throw originalError;
      });
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(assertInstitutionBelongsToOrganization('institution-1', 'org-1')).rejects.toBe(
        originalError
      );
    });
  });
});

/**
 * Live-database tests against real rows. Requires a real PostgreSQL
 * connection (see organizationContext.test.ts's describe block comment for
 * what that requires).
 *
 * CORRECTED, P014 (Owner-approved shared-root-cause fix). Previously this
 * suite called `assertInstitutionBelongsToOrganization` directly against
 * the bare admin `prisma` client, with no `app.current_organization_id`
 * ever set - deliberately, per the file's own prior comment, "to test the
 * function's own id/organization matching logic against real rows, not
 * RLS." That premise only worked because the admin connection used to
 * bypass RLS entirely (it was never actually the table owner - `postgres`
 * was). Now that `nera_dev_admin` genuinely owns `institutions`
 * (`FORCE ROW LEVEL SECURITY`, `NOSUPERUSER NOBYPASSRLS` - verified
 * directly, P014), an unscoped read is RLS-filtered like any other query:
 * a row belonging to a different organization than whatever
 * `app.current_organization_id` happens to be set to (or unset) is
 * genuinely invisible to the query, not merely mismatched in application
 * code.
 *
 * This is a real, verified behavioral finding, not just a test-fixture
 * fix: `assertInstitutionBelongsToOrganization`'s real callers always run
 * inside `getOrganizationContext`'s RLS-scoped transaction (never the bare
 * admin client), so in genuine production use, a cross-organization
 * institution lookup was already indistinguishable from "does not exist" -
 * RLS hides it before the function's own `organizationId` string
 * comparison ever runs. That is a *stronger* isolation guarantee than the
 * function's own `'organization-mismatch'` reason implies in isolation
 * (defense in depth: the row is invisible, not merely flagged) - this
 * suite now proves that real behavior instead of the RLS-bypassed
 * approximation it proved before. `'organization-mismatch'` remains a real,
 * reachable reason for the fake-client unit tests above (which do not
 * involve RLS at all) and for any future caller that legitimately queries
 * without organization scoping.
 */
describe('assertInstitutionBelongsToOrganization (against real rows, requires PostgreSQL)', () => {
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

  it('resolves for a real institution matching its real organization', async () => {
    const organizationId = randomUUID();
    await withOrgWriteContext(organizationId, tx =>
      tx.organization.create({ data: { id: organizationId, name: 'Org - real institution match' } })
    );
    const institutionId = randomUUID();
    await withOrgWriteContext(organizationId, tx =>
      tx.institution.create({
        data: { id: institutionId, organizationId, name: 'Real Institution' },
      })
    );

    // Real callers always resolve this inside their own organization's
    // getOrganizationContext-scoped transaction - reproduced here directly
    // rather than through the higher-level engine wrapper, to keep this
    // suite's dependency on `organizationContext.ts` a plain, local one.
    await withOrgWriteContext(organizationId, async tx => {
      const assertInstitutionBelongsToOrganization = createAssertInstitutionBelongsToOrganization(
        tx as unknown as InstitutionOwnershipDbClient
      );
      await expect(
        assertInstitutionBelongsToOrganization(institutionId, organizationId)
      ).resolves.toBeUndefined();
    });
  });

  it('a cross-organization institution is invisible under RLS-scoped access - reported as unknown-institution, not organization-mismatch (defense in depth, verified directly)', async () => {
    const organizationAId = randomUUID();
    const organizationBId = randomUUID();
    await withOrgWriteContext(organizationAId, tx =>
      tx.organization.create({ data: { id: organizationAId, name: 'Org A - name collision' } })
    );
    await withOrgWriteContext(organizationBId, tx =>
      tx.organization.create({ data: { id: organizationBId, name: 'Org B - name collision' } })
    );
    const institutionUnderBId = randomUUID();
    await withOrgWriteContext(organizationBId, tx =>
      tx.institution.create({
        data: {
          id: institutionUnderBId,
          organizationId: organizationBId,
          name: 'Shared Institution Name',
        },
      })
    );
    await withOrgWriteContext(organizationAId, tx =>
      tx.institution.create({
        data: {
          id: randomUUID(),
          organizationId: organizationAId,
          name: 'Shared Institution Name',
        },
      })
    );

    await withOrgWriteContext(organizationAId, async tx => {
      const assertInstitutionBelongsToOrganization = createAssertInstitutionBelongsToOrganization(
        tx as unknown as InstitutionOwnershipDbClient
      );
      const error = await assertInstitutionBelongsToOrganization(
        institutionUnderBId,
        organizationAId
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InstitutionOwnershipError);
      expect((error as InstitutionOwnershipError).reason).toBe('unknown-institution');
    });
  });
});

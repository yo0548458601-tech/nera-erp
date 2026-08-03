import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma, type Prisma } from '@nera/database';
import { createGetOrganizationContext } from '@nera/organization-engine';
import { asRestrictedRole } from '../testSupport/restrictedRole';

/**
 * P014 document persistence RLS verification (see `docs/ROADMAP.md`),
 * following the exact pattern `entityPersistenceRls.test.ts`/
 * `configurationPersistenceRls.test.ts` established: introspection for
 * every new table, plus behavioral cross-organization isolation.
 *
 * Requires a real PostgreSQL connection with the P014 migration
 * (`..._add_document_persistence`) applied and the RLS test role
 * bootstrapped - see packages/database/README.md.
 */

const RLS_FORCED_DOCUMENT_TABLES = ['documents', 'document_links'] as const;

describe('P014 document persistence RLS configuration (introspection, requires PostgreSQL)', () => {
  it.each(RLS_FORCED_DOCUMENT_TABLES)('"%s" has RLS enabled and forced', async tableName => {
    const rows = await prisma.$queryRaw<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE oid = ${tableName}::regclass
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.relrowsecurity).toBe(true);
    expect(rows[0]?.relforcerowsecurity).toBe(true);
  });

  it.each(RLS_FORCED_DOCUMENT_TABLES)(
    '"%s" has an organization_id-keyed isolation policy',
    async tableName => {
      const rows = await prisma.$queryRaw<Array<{ qual: string | null }>>`
        SELECT qual
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ${tableName}
          AND policyname = ${`${tableName}_organization_isolation`}
      `;

      expect(rows).toHaveLength(1);
      expect(rows[0]?.qual).toContain('current_organization_id');
    }
  );
});

describe('P014 document persistence RLS behavioral isolation (requires PostgreSQL)', () => {
  const getOrganizationContext = createGetOrganizationContext(prisma);

  /**
   * Every FORCE-RLS write below (`organizations`, `documents`,
   * `document_links`) must run with `app.current_organization_id` set to
   * the exact row being written - verified directly during P014: with
   * `nera_dev_admin` now genuinely owning these tables (not `postgres`),
   * `FORCE ROW LEVEL SECURITY` applies to it too (that is what `FORCE`
   * means - it removes the table-owner exemption), so an unwrapped insert
   * is rejected with "new row violates row-level security policy" exactly
   * like any other role. This mirrors the same fix applied to
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

  async function createOrganization(name: string): Promise<string> {
    const id = randomUUID();
    await withOrgWriteContext(id, tx => tx.organization.create({ data: { id, name } }));
    return id;
  }

  async function createUserProfile(): Promise<string> {
    const userProfile = await prisma.userProfile.create({
      data: { id: randomUUID(), authenticationUserId: `document-rls-test-${randomUUID()}` },
    });
    return userProfile.id;
  }

  async function createDocument(organizationId: string, createdByUserId: string, filename: string) {
    return withOrgWriteContext(organizationId, tx =>
      tx.document.create({
        data: {
          id: randomUUID(),
          organizationId,
          status: 'available',
          storageKey: `organizations/${organizationId}/documents/${randomUUID()}`,
          originalFilename: filename,
          contentType: 'application/pdf',
          fileSizeBytes: 10,
          checksumSha256: filename.repeat(64).slice(0, 64),
          createdByUserId,
        },
      })
    );
  }

  it("never sees another organization's documents", async () => {
    const orgA = await createOrganization('Org A - document RLS isolation');
    const orgB = await createOrganization('Org B - document RLS isolation');
    const userA = await createUserProfile();
    const userB = await createUserProfile();

    await createDocument(orgA, userA, 'a');
    await createDocument(orgB, userB, 'b');

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.document.findMany())
    );

    expect(visibleToA.every(document => document.organizationId === orgA)).toBe(true);
    expect(visibleToA.some(document => document.organizationId === orgB)).toBe(false);
  });

  it("never sees another organization's document links", async () => {
    const orgA = await createOrganization('Org A - document link RLS isolation');
    const orgB = await createOrganization('Org B - document link RLS isolation');
    const userA = await createUserProfile();
    const userB = await createUserProfile();

    const documentA = await createDocument(orgA, userA, 'a');
    const documentB = await createDocument(orgB, userB, 'b');

    await withOrgWriteContext(orgA, tx =>
      tx.documentLink.create({
        data: {
          id: randomUUID(),
          organizationId: orgA,
          documentId: documentA.id,
          targetRecordType: 'purchase_order',
          targetRecordId: randomUUID(),
          linkedByUserId: userA,
        },
      })
    );
    await withOrgWriteContext(orgB, tx =>
      tx.documentLink.create({
        data: {
          id: randomUUID(),
          organizationId: orgB,
          documentId: documentB.id,
          targetRecordType: 'purchase_order',
          targetRecordId: randomUUID(),
          linkedByUserId: userB,
        },
      })
    );

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.documentLink.findMany())
    );

    expect(visibleToA.every(link => link.organizationId === orgA)).toBe(true);
    expect(visibleToA.some(link => link.organizationId === orgB)).toBe(false);
  });

  it('the unique index rejects a duplicate identical link (same document, same target record)', async () => {
    const orgA = await createOrganization('Org A - document link uniqueness');
    const userA = await createUserProfile();
    const documentA = await createDocument(orgA, userA, 'a');
    const targetRecordId = randomUUID();

    await withOrgWriteContext(orgA, tx =>
      tx.documentLink.create({
        data: {
          id: randomUUID(),
          organizationId: orgA,
          documentId: documentA.id,
          targetRecordType: 'purchase_order',
          targetRecordId,
          linkedByUserId: userA,
        },
      })
    );

    await expect(
      withOrgWriteContext(orgA, tx =>
        tx.documentLink.create({
          data: {
            id: randomUUID(),
            organizationId: orgA,
            documentId: documentA.id,
            targetRecordType: 'purchase_order',
            targetRecordId,
            linkedByUserId: userA,
          },
        })
      )
    ).rejects.toThrow();
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@nera/database';
import { createGetOrganizationContext } from './organizationContext';
import { asRestrictedRole } from './testSupport/restrictedRole';

/**
 * P013A entity-persistence RLS verification (see `docs/ROADMAP.md` and the
 * P013A design document's RLS matrix). Lives alongside `rlsPolicies.test.ts`
 * (introspection) and `organizationContext.test.ts` (behavioral isolation)
 * because both the restricted-role harness (`asRestrictedRole`) and the
 * `getOrganizationContext` transaction wrapper this suite exercises already
 * live in this package - entity-engine's persistence repositories are pure
 * Prisma CRUD with no RLS-testing infrastructure of their own (P012's own
 * design decision, reused here rather than duplicated).
 *
 * Requires a real PostgreSQL connection with the P013A migration applied
 * and the RLS test role bootstrapped - see packages/database/README.md.
 * Behavioral cross-organization isolation is proven directly for `entities`,
 * `phones`, and `notes` (a representative subset, not all 9 tables - the
 * remaining 6 are covered by the introspection checks below, which confirm
 * RLS is enabled/forced/policy-correct for every one of the 9 new tables;
 * the isolation *mechanism* itself - `set_config` + a `USING` policy keyed
 * on `organization_id` - is identical across all 9 and is not re-derived
 * per table).
 */

const RLS_FORCED_ENTITY_TABLES = [
  'entities',
  'person_profiles',
  'phones',
  'emails',
  'addresses',
  'notes',
  'role_assignments',
  'duplicate_override_records',
  'list_view_column_preferences',
] as const;

describe('P013A entity persistence RLS configuration (introspection, requires PostgreSQL)', () => {
  it.each(RLS_FORCED_ENTITY_TABLES)('"%s" has RLS enabled and forced', async tableName => {
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

  it.each(RLS_FORCED_ENTITY_TABLES)(
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

describe('P013A entity persistence RLS behavioral isolation (requires PostgreSQL)', () => {
  const getOrganizationContext = createGetOrganizationContext(prisma);

  async function createOrganization(name: string): Promise<string> {
    const organization = await prisma.organization.create({ data: { id: randomUUID(), name } });
    return organization.id;
  }

  it("never sees another organization's entities", async () => {
    const orgA = await createOrganization('Org A - entity RLS isolation');
    const orgB = await createOrganization('Org B - entity RLS isolation');
    await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        neraId: 'NERA-00000001',
        entityType: 'person',
      },
    });
    await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        neraId: 'NERA-00000001',
        entityType: 'person',
      },
    });

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.entity.findMany())
    );

    expect(visibleToA.every(entity => entity.organizationId === orgA)).toBe(true);
    expect(visibleToA.some(entity => entity.organizationId === orgB)).toBe(false);
  });

  it("never sees phones belonging to another organization's entity", async () => {
    const orgA = await createOrganization('Org A - phone RLS isolation');
    const orgB = await createOrganization('Org B - phone RLS isolation');
    const entityA = await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        neraId: 'NERA-00000002',
        entityType: 'person',
      },
    });
    const entityB = await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        neraId: 'NERA-00000002',
        entityType: 'person',
      },
    });
    await prisma.phone.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        entityId: entityA.id,
        number: '0501111111',
        type: 'mobile',
      },
    });
    await prisma.phone.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        entityId: entityB.id,
        number: '0502222222',
        type: 'mobile',
      },
    });

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.phone.findMany())
    );

    expect(visibleToA.every(phone => phone.organizationId === orgA)).toBe(true);
  });

  it('the partial unique index rejects a second primary active phone for the same entity', async () => {
    const orgA = await createOrganization('Org A - primary phone uniqueness');
    const entity = await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        neraId: 'NERA-00000003',
        entityType: 'person',
      },
    });
    await prisma.phone.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        entityId: entity.id,
        number: '0501111111',
        type: 'mobile',
        isPrimary: true,
      },
    });

    await expect(
      prisma.phone.create({
        data: {
          id: randomUUID(),
          organizationId: orgA,
          entityId: entity.id,
          number: '0502222222',
          type: 'mobile',
          isPrimary: true,
        },
      })
    ).rejects.toThrow();
  });

  it("never sees notes belonging to another organization's entity", async () => {
    const orgA = await createOrganization('Org A - note RLS isolation');
    const orgB = await createOrganization('Org B - note RLS isolation');
    const entityA = await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        neraId: 'NERA-00000004',
        entityType: 'person',
      },
    });
    const entityB = await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        neraId: 'NERA-00000004',
        entityType: 'person',
      },
    });
    const userProfile = await prisma.userProfile.create({
      data: { id: randomUUID(), authenticationUserId: `note-rls-test-${randomUUID()}` },
    });
    await prisma.note.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        entityId: entityA.id,
        content: 'Org A note',
        createdByUserId: userProfile.id,
      },
    });
    await prisma.note.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        entityId: entityB.id,
        content: 'Org B note',
        createdByUserId: userProfile.id,
      },
    });

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.note.findMany())
    );

    expect(visibleToA.every(note => note.organizationId === orgA)).toBe(true);
  });
});

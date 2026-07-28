import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@nera/database';
import { createGetOrganizationContext } from './organizationContext';
import { asRestrictedRole } from './testSupport/restrictedRole';

/**
 * P013B configuration-persistence RLS verification (see `docs/ROADMAP.md`),
 * following the exact pattern `entityPersistenceRls.test.ts` established for
 * P013A: introspection for every new table, plus behavioral cross-organization
 * isolation for a representative subset.
 *
 * Requires a real PostgreSQL connection with the P013B migration
 * (`20260728204824_add_configuration_persistence`) applied and the RLS test
 * role bootstrapped - see packages/database/README.md.
 */

const RLS_FORCED_CONFIGURATION_TABLES = [
  'custom_field_definitions',
  'custom_field_values',
  'field_requirement_rules',
  'role_definitions',
] as const;

describe('P013B configuration persistence RLS configuration (introspection, requires PostgreSQL)', () => {
  it.each(RLS_FORCED_CONFIGURATION_TABLES)('"%s" has RLS enabled and forced', async tableName => {
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

  it.each(RLS_FORCED_CONFIGURATION_TABLES)(
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

  it.each(RLS_FORCED_CONFIGURATION_TABLES)(
    '"%s" has no institution_id column (Owner decision 3, P013B)',
    async tableName => {
      const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = 'institution_id'
      `;

      expect(rows).toHaveLength(0);
    }
  );
});

describe('P013B configuration persistence RLS behavioral isolation (requires PostgreSQL)', () => {
  const getOrganizationContext = createGetOrganizationContext(prisma);

  async function createOrganization(name: string): Promise<string> {
    const organization = await prisma.organization.create({ data: { id: randomUUID(), name } });
    return organization.id;
  }

  it("never sees another organization's role definitions", async () => {
    const orgA = await createOrganization('Org A - role definition RLS isolation');
    const orgB = await createOrganization('Org B - role definition RLS isolation');
    await prisma.roleDefinition.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        key: 'volunteer',
        label: 'מתנדב',
        description: '',
        applicableEntityTypes: ['person'],
      },
    });
    await prisma.roleDefinition.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        key: 'volunteer',
        label: 'מתנדב',
        description: '',
        applicableEntityTypes: ['person'],
      },
    });

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.roleDefinition.findMany())
    );

    expect(visibleToA.every(role => role.organizationId === orgA)).toBe(true);
    expect(visibleToA.some(role => role.organizationId === orgB)).toBe(false);
  });

  it("never sees another organization's custom field definitions", async () => {
    const orgA = await createOrganization('Org A - custom field RLS isolation');
    const orgB = await createOrganization('Org B - custom field RLS isolation');
    await prisma.customFieldDefinition.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        key: 'shirt_size',
        label: 'מידת חולצה',
        fieldType: 'short_text',
        targetScope: 'entity_type',
        targetEntityType: 'person',
      },
    });
    await prisma.customFieldDefinition.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        key: 'shirt_size',
        label: 'מידת חולצה',
        fieldType: 'short_text',
        targetScope: 'entity_type',
        targetEntityType: 'person',
      },
    });

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.customFieldDefinition.findMany())
    );

    expect(visibleToA.every(definition => definition.organizationId === orgA)).toBe(true);
    expect(visibleToA.some(definition => definition.organizationId === orgB)).toBe(false);
  });

  it("never sees another organization's custom field values", async () => {
    const orgA = await createOrganization('Org A - custom field value RLS isolation');
    const orgB = await createOrganization('Org B - custom field value RLS isolation');
    const entityA = await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        neraId: 'NERA-00000901',
        entityType: 'person',
      },
    });
    const entityB = await prisma.entity.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        neraId: 'NERA-00000901',
        entityType: 'person',
      },
    });
    const definitionA = await prisma.customFieldDefinition.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        key: 'shirt_size',
        label: 'מידת חולצה',
        fieldType: 'short_text',
        targetScope: 'entity_type',
        targetEntityType: 'person',
      },
    });
    const definitionB = await prisma.customFieldDefinition.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        key: 'shirt_size',
        label: 'מידת חולצה',
        fieldType: 'short_text',
        targetScope: 'entity_type',
        targetEntityType: 'person',
      },
    });
    const userProfile = await prisma.userProfile.create({
      data: { id: randomUUID(), authenticationUserId: `cf-value-rls-test-${randomUUID()}` },
    });
    await prisma.customFieldValue.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        customFieldDefinitionId: definitionA.id,
        entityId: entityA.id,
        value: { type: 'short_text', value: 'M' },
        updatedByUserId: userProfile.id,
      },
    });
    await prisma.customFieldValue.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        customFieldDefinitionId: definitionB.id,
        entityId: entityB.id,
        value: { type: 'short_text', value: 'L' },
        updatedByUserId: userProfile.id,
      },
    });

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.customFieldValue.findMany())
    );

    expect(visibleToA.every(value => value.organizationId === orgA)).toBe(true);
    expect(visibleToA.some(value => value.organizationId === orgB)).toBe(false);
  });

  it("never sees another organization's field requirement rules", async () => {
    const orgA = await createOrganization('Org A - field requirement rule RLS isolation');
    const orgB = await createOrganization('Org B - field requirement rule RLS isolation');
    await prisma.fieldRequirementRule.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        fieldKey: 'birthDate',
        scope: 'role',
        targetId: 'student',
        mode: 'required',
      },
    });
    await prisma.fieldRequirementRule.create({
      data: {
        id: randomUUID(),
        organizationId: orgB,
        fieldKey: 'birthDate',
        scope: 'role',
        targetId: 'student',
        mode: 'optional',
      },
    });

    const visibleToA = await getOrganizationContext(
      { organizationId: orgA },
      asRestrictedRole(async tx => tx.fieldRequirementRule.findMany())
    );

    expect(visibleToA.every(rule => rule.organizationId === orgA)).toBe(true);
    expect(visibleToA.some(rule => rule.organizationId === orgB)).toBe(false);
  });

  it('the unique index rejects a second role definition with the same key in the same organization', async () => {
    const orgA = await createOrganization('Org A - role definition key uniqueness');
    await prisma.roleDefinition.create({
      data: {
        id: randomUUID(),
        organizationId: orgA,
        key: 'volunteer',
        label: 'מתנדב',
        description: '',
        applicableEntityTypes: ['person'],
      },
    });

    await expect(
      prisma.roleDefinition.create({
        data: {
          id: randomUUID(),
          organizationId: orgA,
          key: 'volunteer',
          label: 'מתנדב 2',
          description: '',
          applicableEntityTypes: ['person'],
        },
      })
    ).rejects.toThrow();
  });
});

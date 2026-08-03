import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * The canonical `PermissionId` catalog, transcribed by hand from
 * `packages/engines/authorization/src/permissions.ts` (P011 - see
 * `docs/ROADMAP.md`).
 *
 * Not imported directly: `@nera/database` sits at the Platform layer and
 * `@nera/authorization-engine` sits at the Core Engine layer
 * (`packages/core/src/dependencyRules.ts`), and a Platform package importing
 * a Core Engine package is a layer-order violation caught by
 * `dependencyRules.test.ts`. Duplicating the id list by hand is the smallest
 * repository-compliant option - the same convention `packages/core/src/
 * engine.ts` already uses for transcribing `ENGINE_MAP.md`. Only the ids
 * themselves are duplicated (not the Hebrew labels/descriptions), to keep
 * the duplicated surface - and the manual-sync burden - as small as
 * possible; `description` below is intentionally left unset rather than
 * fabricated. Keep this list in sync with `permissions.ts` by hand; do not
 * rename, remove, or invent a `PermissionId` here - this file only mirrors
 * the existing catalog.
 */
const CANONICAL_PERMISSION_IDS: readonly string[] = [
  'notes.edit',
  'notes.delete',
  'notes.restore',
  'entities.edit',
  'entities.roles.manage',
  'entities.view_sensitive',
  'entities.export',
  'entities.import',
  'entities.merge',
  'entities.duplicate_override',
  'entities.archive',
  'finance.view',
  'finance.payment_priority',
  'finance.clear_priority_markers',
  'modules.access',
  'roles.manage_definitions',
  'custom_fields.manage',
  'custom_fields.view_sensitive',
  'list_views.manage_defaults',
  'field_requirements.manage_defaults',
  'contact_methods.edit',
  'contact_methods.deactivate',
  'contact_methods.remove',
  'contact_methods.restore',
  'birth_date.view',
  'birth_date.edit',
  'documents.upload',
  'documents.download',
  'documents.delete',
  'documents.restore',
  'documents.hard_delete',
  'documents.manage_links',
];

/**
 * The schema's `resource`/`action` columns are required and don't exist on
 * the source `PermissionId` catalog (a flat dotted id + Hebrew label/
 * description). They are derived mechanically by splitting each id on its
 * *last* "." - e.g. "entities.roles.manage" -> resource "entities.roles",
 * action "manage" - a formatting step only; it changes no id, and invents no
 * new taxonomy.
 */
function splitPermissionKey(permissionKey: string): { resource: string; action: string } {
  const lastDotIndex = permissionKey.lastIndexOf('.');
  return {
    resource: permissionKey.slice(0, lastDotIndex),
    action: permissionKey.slice(lastDotIndex + 1),
  };
}

/**
 * The built-in role catalog, transcribed by hand from
 * `packages/engines/entities/src/roles.ts`'s `entityRoleRegistry`
 * (P013B - see `docs/ROADMAP.md`), for the same layer-order reason
 * `CANONICAL_PERMISSION_IDS` above is transcribed rather than imported:
 * `@nera/database` (Platform layer) cannot import `@nera/entity-engine`
 * (Core Engine layer). Every organization gets its own copy of these 12
 * rows (Owner decision: NOT NULL organizationId, no nullable "global" row -
 * see roleDefinitionRepository.ts) - this seed only ever creates them for
 * the platform seed organization; a future "create organization" flow must
 * seed its own organization's copy the same way. Keep in sync with
 * `entityRoleRegistry` by hand; do not rename, remove, or invent a role key
 * here - this only mirrors the existing catalog.
 */
const BUILT_IN_ROLE_DEFINITIONS: ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  applicableEntityTypes: ('person' | 'organization')[];
  order: number;
  showInGlobalAddNew?: boolean;
  allowMultipleAssignments?: boolean;
  supportsBillingProfile?: boolean;
}> = [
  {
    key: 'contact',
    label: 'איש קשר',
    description: 'איש קשר כללי ללא שיוך עסקי ספציפי.',
    applicableEntityTypes: ['person'],
    order: 0,
  },
  {
    key: 'employee',
    label: 'עובד',
    description: 'עובד בארגון.',
    applicableEntityTypes: ['person'],
    order: 1,
    showInGlobalAddNew: true,
  },
  {
    key: 'avreich',
    label: 'אברך',
    description: 'אברך המשויך למוסד לימוד.',
    applicableEntityTypes: ['person'],
    order: 2,
    showInGlobalAddNew: true,
  },
  {
    key: 'student',
    label: 'תלמיד',
    description: 'תלמיד המשויך למסגרת לימודים.',
    applicableEntityTypes: ['person'],
    order: 3,
    showInGlobalAddNew: true,
  },
  {
    key: 'parent',
    label: 'הורה',
    description: 'הורה או אפוטרופוס של תלמיד.',
    applicableEntityTypes: ['person'],
    order: 4,
  },
  {
    key: 'donor',
    label: 'תורם',
    description: 'תורם לארגון.',
    applicableEntityTypes: ['person', 'organization'],
    order: 5,
    allowMultipleAssignments: true,
    supportsBillingProfile: true,
  },
  {
    key: 'administrator',
    label: 'מנהל מערכת',
    description: 'הרשאת ניהול מערכת.',
    applicableEntityTypes: ['person'],
    order: 6,
  },
  {
    key: 'individual_supplier',
    label: 'ספק פרטי',
    description: 'איש קשר המשמש כספק באופן פרטי, שלא דרך חברה.',
    applicableEntityTypes: ['person'],
    order: 7,
    supportsBillingProfile: true,
  },
  {
    key: 'supplier',
    label: 'ספק',
    description: 'ארגון המספק שירותים או מוצרים.',
    applicableEntityTypes: ['organization'],
    order: 8,
    showInGlobalAddNew: true,
    supportsBillingProfile: true,
  },
  {
    key: 'customer',
    label: 'לקוח',
    description: 'גורם הרוכש שירותים או מוצרים.',
    applicableEntityTypes: ['person', 'organization'],
    order: 9,
    supportsBillingProfile: true,
  },
  {
    key: 'partner',
    label: 'שותף עסקי',
    description: 'ארגון שותף עסקית.',
    applicableEntityTypes: ['organization'],
    order: 10,
  },
  {
    key: 'service_provider',
    label: 'נותן שירות',
    description: 'גורם המעניק שירות לארגון.',
    applicableEntityTypes: ['person', 'organization'],
    order: 11,
  },
];

/**
 * Every row this script seeds belongs to this one fixed organization
 * (or, for `Permission`, no organization at all - see below).
 */
const SEED_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000000';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.info('Skipping database seed in production.');
    return;
  }

  await prisma.$transaction(async tx => {
    /**
     * Newly-required as of P014 (verified directly, not assumed): every
     * tenant-scoped table now has `FORCE ROW LEVEL SECURITY`, and - since
     * the Owner-approved local role architecture keeps `nera_dev_admin`
     * `NOSUPERUSER NOBYPASSRLS`, deliberately never bypassing RLS - the
     * table owner is no longer exempt from its own policies (`FORCE` exists
     * specifically to remove that exemption). Every insert below therefore
     * needs `app.current_organization_id` set to the exact row it's about
     * to write, matching `getOrganizationContext`'s own mechanism -
     * `@nera/database` cannot import `@nera/organization-engine` directly
     * (Platform layer importing Core Engine layer is a boundary violation,
     * `packages/core/src/dependencyRules.ts`), so this is done here as the
     * same raw `set_config` call, not a shared import.
     */
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_organization_id', $1, true)`,
      SEED_ORGANIZATION_ID
    );

    const organization = await tx.organization.upsert({
      where: { id: SEED_ORGANIZATION_ID },
      update: {},
      create: {
        id: SEED_ORGANIZATION_ID,
        name: 'Platform Seed Organization',
        legalName: 'Platform Seed Organization',
        registrationNumber: 'SEED-001',
        defaultLocale: 'en',
        defaultTimezone: 'UTC',
        defaultCalendarDisplay: 'gregorian',
      },
    });

    // Replace any previously-seeded permission that is not part of the
    // canonical PermissionId catalog (e.g. the old placeholder
    // "platform.organization.*" rows this seed used before P011). Child
    // RolePermission rows are removed first - the foreign key is RESTRICT.
    // `Permission` itself carries no organization_id and has no RLS policy
    // (it is the one genuinely global, not tenant-scoped, table this seed
    // touches) - unaffected by the FORCE RLS change above either way.
    const obsoletePermissions = await tx.permission.findMany({
      where: { permissionKey: { notIn: [...CANONICAL_PERMISSION_IDS] } },
      select: { id: true },
    });
    if (obsoletePermissions.length > 0) {
      const obsoletePermissionIds = obsoletePermissions.map(permission => permission.id);
      await tx.rolePermission.deleteMany({
        where: { permissionId: { in: obsoletePermissionIds } },
      });
      await tx.permission.deleteMany({ where: { id: { in: obsoletePermissionIds } } });
    }

    for (const permissionKey of CANONICAL_PERMISSION_IDS) {
      const { resource, action } = splitPermissionKey(permissionKey);
      await tx.permission.upsert({
        where: { permissionKey },
        update: { resource, action },
        create: { permissionKey, resource, action },
      });
    }

    const systemRole = await tx.role.upsert({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      update: {},
      create: {
        id: '11111111-1111-1111-1111-111111111111',
        organizationId: organization.id,
        name: 'System Administrator',
        description: 'System administrator template role',
        isSystemRole: true,
        status: 'active',
      },
    });

    const allPermissions = await tx.permission.findMany();
    for (const permission of allPermissions) {
      await tx.rolePermission.upsert({
        where: {
          role_permissions_org_role_permission_unique: {
            organizationId: organization.id,
            roleId: systemRole.id,
            permissionId: permission.id,
          },
        },
        update: { effect: 'allow' },
        create: {
          organizationId: organization.id,
          roleId: systemRole.id,
          permissionId: permission.id,
          effect: 'allow',
        },
      });
    }

    // Real demo identity (P013A - see docs/ROADMAP.md). The demo session
    // (apps/web's demoAuth.ts) points at these exact ids so checkPermission()/
    // getOrganizationContext() resolve against real rows instead of
    // placeholder strings matching nothing in the database - this is still
    // demo-mode, not real authentication: no login flow is introduced.
    const demoUserProfile = await tx.userProfile.upsert({
      where: { id: '22222222-2222-2222-2222-222222222222' },
      update: {},
      create: {
        id: '22222222-2222-2222-2222-222222222222',
        authenticationUserId: 'demo-user',
        displayName: 'Demo User',
        status: 'active',
      },
    });

    const demoMembership = await tx.organizationMembership.upsert({
      where: { id: '33333333-3333-3333-3333-333333333333' },
      update: {},
      create: {
        id: '33333333-3333-3333-3333-333333333333',
        organizationId: organization.id,
        userProfileId: demoUserProfile.id,
        status: 'active',
      },
    });

    await tx.membershipRole.upsert({
      where: {
        membership_roles_membership_role_unique: {
          organizationMembershipId: demoMembership.id,
          roleId: systemRole.id,
        },
      },
      update: {},
      create: {
        id: '44444444-4444-4444-4444-444444444444',
        organizationId: organization.id,
        organizationMembershipId: demoMembership.id,
        roleId: systemRole.id,
      },
    });

    // Built-in role definitions (P013B - see docs/ROADMAP.md). isSystem rows
    // are seeded once and never overwritten by `update: {}` on subsequent
    // seed runs, matching the platform's "built-in roles ship with the
    // engine" invariant - an administrator's own status/metadata edits (if
    // any were ever made directly in the database) are not clobbered by a
    // re-seed.
    for (const role of BUILT_IN_ROLE_DEFINITIONS) {
      await tx.roleDefinition.upsert({
        where: {
          role_definitions_organization_key_unique: {
            organizationId: organization.id,
            key: role.key,
          },
        },
        update: {},
        create: {
          organizationId: organization.id,
          key: role.key,
          label: role.label,
          description: role.description,
          applicableEntityTypes: role.applicableEntityTypes,
          order: role.order,
          showInGlobalAddNew: role.showInGlobalAddNew ?? false,
          allowMultipleAssignments: role.allowMultipleAssignments ?? false,
          supportsDateRange: true,
          supportsBillingProfile: role.supportsBillingProfile ?? false,
          requiredPermissions: {},
          linkedCustomFieldDefinitionIds: [],
          isSystem: true,
        },
      });
    }

    console.info('Database seed completed.');
  });
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

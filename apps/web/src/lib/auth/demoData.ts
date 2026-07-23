import { DEMO_ORGANIZATION_ID, DEMO_USER_PROFILE_ID } from './demoIdentity';

export type DemoOrganization = {
  id: string;
  name: string;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * `id` matches the real seeded UserProfile row (P013A - see demoIdentity.ts)
 * - checkPermission()/getOrganizationContext() resolve against a real
 * database row now, not a placeholder string. Still not real authentication.
 */
export const demoUser: DemoUser = {
  id: DEMO_USER_PROFILE_ID,
  name: 'מנהל מערכת',
  email: 'demo@nera.local',
  role: 'מנהל מערכת',
};

/**
 * Only the first (default-selected) organization matches a real seeded row
 * (P013A). The other two remain placeholder ids with no backing database
 * row - they exist only for the unrelated, pre-P013A, not-yet-persisted
 * institution-scoping demos (RoleDefinitionsPanel/FieldRequirementsPanel),
 * where a fabricated id is harmless because nothing is ever written to a
 * real column. See `persistedDemoOrganizations` below for the subset that
 * is safe to use anywhere a value will reach a real, persisted
 * `organizationId` (a `@db.Uuid` Postgres column) - selecting one of these
 * two elsewhere throws a real, verified Prisma crash: "Error creating UUID,
 * invalid character... found `o` at 1" (the leading `o` of `org-...`).
 */
export const demoOrganizations: DemoOrganization[] = [
  { id: DEMO_ORGANIZATION_ID, name: 'ארגון ראשי' },
  { id: 'org-jerusalem', name: 'מוסד ירושלים' },
  { id: 'org-bnei-brak', name: 'סניף בני ברק' },
];

/**
 * The subset of `demoOrganizations` backed by a real, seeded `Organization`
 * row - safe to use as the session's *current organization* (the tenant
 * boundary every real P013A query is scoped by via `organizationId`), or
 * anywhere else a selection is forwarded into a Server Action that touches
 * Prisma. Use this, never the full `demoOrganizations`, for: the session's
 * `organizations` list, the organization switcher, and any role/entity
 * assignment scoping control that persists.
 */
export const persistedDemoOrganizations: DemoOrganization[] = demoOrganizations.filter(
  organization => organization.id === DEMO_ORGANIZATION_ID
);

export const demoPermissions = ['read:dashboard', 'write:settings'];

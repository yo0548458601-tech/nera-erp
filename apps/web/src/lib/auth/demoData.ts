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
 * row - switching to them keeps the pre-P013A demo UI behavior but will not
 * resolve real, persisted entity data (no Organization row exists for them
 * to satisfy entities' organization_id foreign key).
 */
export const demoOrganizations: DemoOrganization[] = [
  { id: DEMO_ORGANIZATION_ID, name: 'ארגון ראשי' },
  { id: 'org-jerusalem', name: 'מוסד ירושלים' },
  { id: 'org-bnei-brak', name: 'סניף בני ברק' },
];

export const demoPermissions = ['read:dashboard', 'write:settings'];

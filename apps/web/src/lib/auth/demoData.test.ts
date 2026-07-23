import { describe, expect, it } from 'vitest';
import { demoOrganizations, persistedDemoOrganizations } from './demoData';
import { DEMO_ORGANIZATION_ID } from './demoIdentity';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Regression tests for a verified P013A production bug (see the
 * implementation report): the "current organization" switcher (AppHeader/
 * AppShell/AuthGate) and the role-assignment organization-scope dropdown
 * (PersonRolesCard) both read from `demoOrganizations`, which includes two
 * placeholder entries (`org-jerusalem`, `org-bnei-brak`) with no backing
 * `Organization` database row - a pre-P013A leftover, still needed for the
 * unrelated, never-persisted institution-scoping demos (RoleDefinitionsPanel/
 * FieldRequirementsPanel). Selecting either placeholder as the *current
 * organization* sent its id straight into `organizationId` (a `@db.Uuid`
 * Postgres column via every real P013A query), crashing with a raw Prisma
 * error: "Error creating UUID, invalid character... found `o` at 1" -
 * reproduced directly against the real database in this session.
 *
 * `persistedDemoOrganizations` is the fix: the subset that is safe to use
 * anywhere a selection reaches a real, persisted `organizationId`. These
 * tests guard against ever widening it back to include a non-UUID id.
 */
describe('persistedDemoOrganizations', () => {
  it('is non-empty (at least the real seeded organization is selectable)', () => {
    expect(persistedDemoOrganizations.length).toBeGreaterThan(0);
  });

  it('contains only UUID-shaped ids - never a placeholder like "org-bnei-brak"', () => {
    for (const organization of persistedDemoOrganizations) {
      expect(organization.id).toMatch(UUID_PATTERN);
    }
  });

  it('contains the real seeded demo organization', () => {
    expect(persistedDemoOrganizations.some(org => org.id === DEMO_ORGANIZATION_ID)).toBe(true);
  });

  it('never contains the exact placeholder ids that reproduced the crash', () => {
    const ids = persistedDemoOrganizations.map(org => org.id);
    expect(ids).not.toContain('org-jerusalem');
    expect(ids).not.toContain('org-bnei-brak');
  });

  it('is a subset of demoOrganizations (not a separately-maintained list that can drift)', () => {
    const fullIds = new Set(demoOrganizations.map(org => org.id));
    for (const organization of persistedDemoOrganizations) {
      expect(fullIds.has(organization.id)).toBe(true);
    }
  });
});

describe('demoOrganizations (full list, still used by non-persisted institution-scoping demos)', () => {
  it('still contains the placeholder institutions - removing them would regress RoleDefinitionsPanel/FieldRequirementsPanel', () => {
    const ids = demoOrganizations.map(org => org.id);
    expect(ids).toContain('org-jerusalem');
    expect(ids).toContain('org-bnei-brak');
  });
});

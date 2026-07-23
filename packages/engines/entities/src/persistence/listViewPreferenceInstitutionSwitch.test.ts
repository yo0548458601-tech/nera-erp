import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appPrisma, type Prisma } from '@nera/database';
import { createListViewPreferenceRepository } from './listViewPreferenceRepository';

/**
 * Same minimal, local stand-in for `@nera/organization-engine`'s
 * `getOrganizationContext` used by `checkPermissionRls.test.ts` and
 * `contactMethodDraftMapping.test.ts` - this package has no dependency on
 * the organization engine (see `package.json`).
 */
async function withOrganizationContext<T>(
  organizationId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return appPrisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
    return work(tx);
  });
}

/**
 * Regression tests for a verified P013A production bug (see the
 * implementation report): selecting the demo "current organization"
 * switcher's "סניף בני ברק" ("Bnei Brak branch") entry - a pre-P013A
 * placeholder id (`org-bnei-brak`) never backed by a real `Organization`
 * row - crashed the Contacts page with a raw Prisma error surfacing from
 * `listViewColumnPreference.findMany()`:
 * "Error creating UUID, invalid character... found `o` at 1". Reproduced
 * directly here against the real database (this is the exact query
 * `getEffectivePreference` runs), and against real, seeded data proving the
 * fix (a real organization id) works correctly.
 *
 * The application-level fix (removing the non-UUID placeholder from the
 * *selectable* organization list, see `apps/web/src/lib/auth/demoData.ts`'s
 * `persistedDemoOrganizations`) means a real user can no longer reach this
 * failure through the UI at all - these tests guard the underlying
 * repository/engine contract directly, independent of the UI fix.
 */
describe('listViewColumnPreference resolution across institution/organization switches (requires PostgreSQL)', () => {
  const ORG_ID = '00000000-0000-0000-0000-000000000000';

  it('the exact reported bug: a non-UUID placeholder organizationId (e.g. "org-bnei-brak") throws a clean, real Prisma UUID error, not a silent success', async () => {
    const repo = createListViewPreferenceRepository(appPrisma);

    await expect(
      repo.getEffectivePreference(
        'contacts',
        { organizationId: 'org-bnei-brak', userId: 'user-1', roleIds: [] },
        ['name']
      )
    ).rejects.toThrow(/Error creating UUID|invalid character/);
  });

  it('the fix: switching to a real, seeded organization id resolves cleanly with no rows present (falls through to the built-in default)', async () => {
    const result = await withOrganizationContext(ORG_ID, async tx => {
      const repo = createListViewPreferenceRepository(tx);
      return repo.getEffectivePreference(
        'contacts',
        { organizationId: ORG_ID, userId: randomUUID(), roleIds: [] },
        ['name', 'phone']
      );
    });

    expect(result).toEqual({
      screenId: 'contacts',
      visibleColumnKeys: ['name', 'phone'],
      source: 'default',
    });
  });

  it('institution-scoped resolution uses the institutionId, never the organizationId, as the match key', async () => {
    const institutionId = randomUUID();
    const wrongTargetId = ORG_ID; // what the bug previously passed by mistake

    await withOrganizationContext(ORG_ID, async tx => {
      const repo = createListViewPreferenceRepository(tx);
      try {
        await repo.setPreference({
          organizationId: ORG_ID,
          scope: 'institution',
          targetId: institutionId,
          screenId: 'contacts',
          visibleColumnKeys: ['institution-columns'],
        });

        // Resolving with the real institutionId must find the row.
        const withRealInstitutionId = await repo.getEffectivePreference(
          'contacts',
          { organizationId: ORG_ID, userId: randomUUID(), roleIds: [], institutionId },
          ['default-columns']
        );
        expect(withRealInstitutionId.source).toBe('institution');
        expect(withRealInstitutionId.visibleColumnKeys).toEqual(['institution-columns']);

        // Resolving with the organizationId in the institutionId slot (the
        // exact bug) must NOT match - it is a different id entirely.
        const withOrganizationIdInSlot = await repo.getEffectivePreference(
          'contacts',
          {
            organizationId: ORG_ID,
            userId: randomUUID(),
            roleIds: [],
            institutionId: wrongTargetId,
          },
          ['default-columns']
        );
        expect(withOrganizationIdInSlot.source).toBe('default');
        expect(withOrganizationIdInSlot.visibleColumnKeys).toEqual(['default-columns']);
      } finally {
        await repo.resetPreference({
          organizationId: ORG_ID,
          scope: 'institution',
          targetId: institutionId,
          screenId: 'contacts',
        });
      }
    });
  });
});

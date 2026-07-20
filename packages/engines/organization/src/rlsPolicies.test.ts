import { describe, expect, it } from 'vitest';
import { prisma } from '@nera/database';

/**
 * Supplementary metadata/introspection tests. These verify that RLS is
 * *configured* as expected (enabled, forced, with the right policy
 * expression) - they do not, and cannot, prove runtime enforcement, and are
 * never a substitute for the behavioral isolation tests in
 * organizationContext.test.ts (P012 owner requirement). Requires a real
 * PostgreSQL connection - see packages/database/README.md.
 */

const RLS_FORCED_TABLES = [
  'organizations',
  'organization_units',
  'organization_memberships',
  'roles',
  'role_permissions',
  'membership_roles',
  'audit_logs',
  'institutions',
] as const;

describe('RLS configuration (metadata/introspection, requires PostgreSQL)', () => {
  it.each(RLS_FORCED_TABLES)('"%s" has RLS enabled and forced', async tableName => {
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

  it('"institutions" has an organization_id-keyed isolation policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ qual: string | null }>>`
      SELECT qual
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'institutions'
        AND policyname = 'institutions_organization_isolation'
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.qual).toContain('current_organization_id');
  });

  it('"user_profiles" and "permissions" remain intentionally unrestricted (USING (true)), not forced', async () => {
    const rows = await prisma.$queryRaw<Array<{ relname: string; relforcerowsecurity: boolean }>>`
      SELECT relname, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('user_profiles', 'permissions')
    `;

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.relforcerowsecurity).toBe(false);
    }
  });
});

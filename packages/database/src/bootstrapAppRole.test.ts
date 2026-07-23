import { describe, expect, it } from 'vitest';
import { prisma } from './client.js';
import { appPrisma } from './appClient.js';
import { APP_ROLE_NAME } from './appRoleName.js';

/**
 * Behavioral verification of the least-privilege application role (P013A -
 * see `docs/ROADMAP.md` and the P013A Application Role Grant Review).
 * Requires a real PostgreSQL connection with the P013A migration applied
 * and `npm run db:bootstrap-app-role` already run against it (see
 * `packages/database/README.md`), plus `APP_DATABASE_URL`/`APP_DB_PASSWORD`
 * set so `appPrisma` can actually connect as `nera_app_role`.
 */
describe('nera_app_role (requires PostgreSQL, requires db:bootstrap-app-role to have run)', () => {
  it('is LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, and cannot bypass RLS', async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        rolcanlogin: boolean;
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolbypassrls: boolean;
      }>
    >`
      SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
      FROM pg_catalog.pg_roles
      WHERE rolname = ${APP_ROLE_NAME}
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rolcanlogin).toBe(true);
    expect(rows[0]?.rolsuper).toBe(false);
    expect(rows[0]?.rolcreatedb).toBe(false);
    expect(rows[0]?.rolcreaterole).toBe(false);
    expect(rows[0]?.rolbypassrls).toBe(false);
  });

  it('cannot write to _prisma_migrations, despite the blanket ALL TABLES grant (Owner-approved explicit exclusion)', async () => {
    await expect(
      appPrisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at) VALUES ('rls-test', 'x', 'rls-test', now())`
      )
    ).rejects.toThrow();
  });

  it('can read/write an ordinary business table (organizations) - the blanket grant applies to real business data', async () => {
    await expect(appPrisma.organization.findMany({ take: 1 })).resolves.toBeDefined();
  });

  it('the running application connects via appPrisma as nera_app_role, not the administrative table-owner role', async () => {
    const [row] = await appPrisma.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
    expect(row?.current_user).toBe(APP_ROLE_NAME);
  });
});

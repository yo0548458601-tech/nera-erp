import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { RLS_TEST_ROLE_NAME } from './rlsTestRole.js';

const prisma = new PrismaClient();

/**
 * Idempotent bootstrap for the restricted PostgreSQL role behavioral RLS
 * tests run under (P012 - see `docs/ROADMAP.md`). Safe to run repeatedly,
 * locally or in CI, against the same database - the role is created only if
 * missing, and the grants are re-applied harmlessly on every run.
 *
 * `NOSUPERUSER NOBYPASSRLS` is the whole point: this role can never bypass
 * Row Level Security, unlike the table-owner/superuser connection Prisma
 * otherwise uses. `NOLOGIN` means it can only ever be assumed via
 * `SET LOCAL ROLE` from a session that is already a superuser (or already a
 * member) - it is never a connectable credential, so there is no new secret
 * to manage.
 */
async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${RLS_TEST_ROLE_NAME}') THEN
        CREATE ROLE "${RLS_TEST_ROLE_NAME}" NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${RLS_TEST_ROLE_NAME}";`
  );
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${RLS_TEST_ROLE_NAME}";`
  );

  console.info(`RLS test role "${RLS_TEST_ROLE_NAME}" is bootstrapped.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

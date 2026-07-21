import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { APP_ROLE_NAME } from './appRoleName.js';

const prisma = new PrismaClient();

/**
 * Idempotent bootstrap for the least-privilege application database role
 * (P013A - see `docs/ROADMAP.md`, and the P013A Application Role design
 * review). Safe to re-run repeatedly, locally or in CI - the role is
 * created only if missing, its password is (re-)applied every run so a
 * rotated `APP_DB_PASSWORD` takes effect, and every grant is re-applied
 * harmlessly.
 *
 * `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` - unlike the P012
 * RLS test role, this is a real, connectable production credential, scoped
 * to exactly the capability real application code needs: it can read/write
 * business tables, but cannot perform DDL, cannot manage roles, and cannot
 * bypass Row Level Security.
 *
 * Grant strategy (Owner-approved, P013A Application Role Grant Review,
 * "Option 4"): a blanket `GRANT ... ON ALL TABLES IN SCHEMA public` plus
 * `ALTER DEFAULT PRIVILEGES`, so every future migration's new table is
 * automatically covered with no recurring per-sprint grant step - and one
 * explicit, one-time exclusion: `_prisma_migrations` is Prisma's own
 * internal migration-tracking table (created in the same `public` schema),
 * and this role must never be able to tamper with migration history. No
 * PostgreSQL schema separation is introduced - the Owner-approved
 * conclusion of that review was that a second schema would protect a
 * category of table (genuinely admin-only business data) that does not
 * exist in this schema today; the one real gap (`_prisma_migrations`) is
 * closed here directly instead.
 */
async function main() {
  const password = process.env.APP_DB_PASSWORD;
  if (!password) {
    throw new Error(
      'bootstrapAppRole: APP_DB_PASSWORD must be set - refusing to create ' +
        `"${APP_ROLE_NAME}" with no password.`
    );
  }

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_ROLE_NAME}') THEN
        CREATE ROLE "${APP_ROLE_NAME}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(
    `ALTER ROLE "${APP_ROLE_NAME}" WITH PASSWORD '${password.replace(/'/g, "''")}';`
  );

  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE_NAME}";`);
  await prisma.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE_NAME}";`
  );
  await prisma.$executeRawUnsafe(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_ROLE_NAME}";`
  );
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE_NAME}";`
  );
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${APP_ROLE_NAME}";`
  );

  // The one explicit, Owner-approved exclusion: this role must never be able
  // to write Prisma's own migration-tracking table, even though the blanket
  // grant above would otherwise cover it (it lives in the same schema).
  await prisma.$executeRawUnsafe(`REVOKE ALL ON "_prisma_migrations" FROM "${APP_ROLE_NAME}";`);

  console.info(`Application role "${APP_ROLE_NAME}" is bootstrapped.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

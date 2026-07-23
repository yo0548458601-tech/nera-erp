import { PrismaClient } from '@prisma/client';

/**
 * The least-privilege application client (P013A - see `docs/ROADMAP.md`).
 * Connects as `nera_app_role` (see `appRoleName.ts`/`bootstrapAppRole.ts`) via
 * `APP_DATABASE_URL`, never as the table-owner/superuser connection `prisma`
 * uses. This is the *default* client for every engine factory that touches
 * tenant-scoped data (`createOrganizationEngine`, `createAuthorizationEngine`,
 * `createAuditEngine`, and every `@nera/entity-engine` persistence
 * repository) - a caller gets the safe client automatically, by simply not
 * supplying one. Administrative tooling (migrations, seed, both bootstrap
 * scripts) uses `prisma` instead, explicitly, never this client.
 */
const globalForAppPrisma = globalThis as typeof globalThis & {
  appPrisma?: PrismaClient;
};

/**
 * Only applies the `datasources` override when `APP_DATABASE_URL` is
 * actually set - passing an explicit override with an `undefined` url
 * throws eagerly, at construction/import time (`PrismaClientConstructorValidationError`),
 * unlike the schema-default `prisma` client (`new PrismaClient()` with no
 * override), which only fails lazily on first query. Without this guard,
 * every test file that transitively imports `@nera/database` - including
 * ones with nothing to do with `appPrisma` - would crash at import time in
 * any environment without `APP_DATABASE_URL` set (e.g. a plain unit-test run
 * with no database at all).
 */
export const appPrisma =
  globalForAppPrisma.appPrisma ??
  (process.env.APP_DATABASE_URL
    ? new PrismaClient({ datasources: { db: { url: process.env.APP_DATABASE_URL } } })
    : new PrismaClient());

if (process.env.NODE_ENV !== 'production') {
  globalForAppPrisma.appPrisma = appPrisma;
}

export default appPrisma;

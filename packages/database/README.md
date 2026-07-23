# @nera/database

Platform database package for Nera.

## Responsibilities

- Prisma schema for platform identity and authorization foundation
- Migration files for the initial platform schema
- Connection validation and development seed infrastructure
- Bootstrap for the restricted PostgreSQL role behavioral RLS tests run under (P012)
- Bootstrap for the least-privilege application database role (P013A)

## Environment

Set `DATABASE_URL` before running migrations or validation. Set `APP_DATABASE_URL` and
`APP_DB_PASSWORD` before bootstrapping or connecting as the application role (see below).

**Where to put them, and why two different mechanisms disagree about it (verified during
P013A — this cost real debugging time and is worth reading before your first setup):**

- **This package's own plain TypeScript scripts** (`validateConnection.ts`,
  `bootstrapRlsTestRole.ts`, `bootstrapAppRole.ts`, `seed.ts` — anything invoked through
  `dotenv/config`) resolve `.env` **relative to the current working directory the script
  actually runs in.** `npm run <script> --workspace=@nera/database` changes the CWD to
  `packages/database` before running the script (this is npm's own workspace behavior, not
  something this package configures) — so these scripts look for `.env` at
  **`packages/database/.env`**, never at the repository root, regardless of where you run
  `npm run` from.
- **The Prisma CLI** (`prisma generate`, `prisma migrate deploy`, `prisma validate`) has its
  own, separate, independent environment-loading mechanism, built into `prisma` itself, not
  into this package. It checks both `packages/database/.env` and
  `packages/database/prisma/.env`. It does **not** read the repository root `.env` either.
- **Neither mechanism ever reads a root-level `.env`.** If you only create `.env` at the
  repository root, every command in this package will fail with "Environment variable not
  found: DATABASE_URL" even though the file genuinely exists on disk.
- **Practical consequence:** create `packages/database/.env` (not the repo root) with
  `DATABASE_URL`, `APP_DATABASE_URL`, and `APP_DB_PASSWORD`. This one file satisfies both
  mechanisms above. A repo-root `.env` (if you also keep one, e.g. for `apps/web`'s own
  Next.js environment loading) is a separate, unrelated file — it does not substitute for
  this one.

## Which client does what

- `prisma` (from `./client.ts`, connects via `DATABASE_URL`) - the table-owner/superuser
  connection. Used **only** by `prisma migrate deploy`, `seed.ts`, and both bootstrap
  scripts. Never the default client for any engine factory.
- `appPrisma` (from `./appClient.ts`, connects via `APP_DATABASE_URL` as `nera_app_role`) -
  the least-privilege connection real application traffic uses. This is the **default**
  client for every engine factory that touches tenant-scoped data
  (`createOrganizationEngine`, `createAuthorizationEngine`, `createAuditEngine`, every
  `@nera/entity-engine` persistence repository) - a caller gets the safe client
  automatically, without needing to pass one explicitly.

## RLS test role

Row Level Security tests (in `@nera/organization-engine`) need a PostgreSQL
role that genuinely cannot bypass RLS - the default connection is the table
owner/superuser, which bypasses RLS regardless of policy. Run once against
any target database, before those tests, locally or in CI:

```
npm run db:bootstrap-rls-role --workspace=@nera/database
```

Safe to re-run - it only creates the role if missing, and re-applies grants
harmlessly. The role is `NOLOGIN`: it is never a connectable credential, only
ever assumed via `SET LOCAL ROLE` from within a test's own transaction.

## Application role

Real application traffic connects as a least-privilege, `LOGIN`-capable role
(`nera_app_role`) - never as the table-owner/superuser connection. Run once
against any target database, after migrations have been applied, before the
application (or any test) connects via `APP_DATABASE_URL`:

```
npm run db:bootstrap-app-role --workspace=@nera/database
```

Safe to re-run - it creates the role only if missing, re-applies its password
and grants every time (so a rotated `APP_DB_PASSWORD` takes effect), and
explicitly revokes its access to Prisma's own `_prisma_migrations` table (the
one exclusion from an otherwise blanket grant - see `bootstrapAppRole.ts` for
the full Owner-approved reasoning). The role is `NOSUPERUSER NOCREATEDB
NOCREATEROLE NOBYPASSRLS`: it can read/write business tables but can never
perform DDL, manage roles, or bypass Row Level Security.

## Local setup sequence

Against any target PostgreSQL database (a fresh local instance or an existing one), in this
exact order - each step depends on the one before it:

1. Create `packages/database/.env` with `DATABASE_URL`, `APP_DATABASE_URL`, and
   `APP_DB_PASSWORD` (see Environment, above). Never invent or guess credentials for a
   database you don't control.
2. `npm run db:generate --workspace=@nera/database` - generates the Prisma Client from the
   current schema.
3. `npm run db:migrate:deploy --workspace=@nera/database` - applies every migration in
   `prisma/migrations/`, in order, including RLS/`FORCE ROW LEVEL SECURITY` and the P013A
   entity-persistence tables.
4. `npm run db:bootstrap-rls-role --workspace=@nera/database` - creates the restricted,
   `NOLOGIN` role live RLS-isolation tests assume via `SET LOCAL ROLE`. Required before
   running `@nera/organization-engine`'s behavioral RLS test suite.
5. `npm run db:bootstrap-app-role --workspace=@nera/database` - creates/refreshes the
   least-privilege, `LOGIN`-capable `nera_app_role` every real application code path (and any
   test using `appPrisma`) connects as. Must run after migrations (it revokes access to a
   table migrations create) and before anything connects via `APP_DATABASE_URL`.
6. `npm run db:seed --workspace=@nera/database` - seeds the real demo organization,
   membership, roles, and permission catalog every demo-identity constant
   (`apps/web/src/lib/auth/demoIdentity.ts`) refers to.
7. Only now: `npm test` (Vitest, including every live-PostgreSQL test in
   `packages/engines/*/src/**/*.test.ts` that requires a real connection) and
   `npm run dev --workspace=apps/web` (or `turbo run dev --filter=web`) both have everything
   they need.

This is exactly the sequence `.github/workflows/ci.yml` runs against its own throwaway,
CI-local PostgreSQL service container - reproducing a CI failure locally means running these
same steps, in this same order, against your own local database.

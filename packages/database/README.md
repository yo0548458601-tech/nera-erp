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

## Local PostgreSQL role architecture (Owner-approved)

Three distinct roles, never interchanged:

- **`postgres`** - the PostgreSQL cluster superuser. **Bootstrap/repair only.** Used to create
  the `nera_dev` database and the `nera_dev_admin` role the first time, and to repair
  ownership/grants if they ever drift (see "Repairing ownership/grants", below). Nera code
  never connects as `postgres`; `DATABASE_URL`/`APP_DATABASE_URL` must never point at it; its
  password is never requested from or entered into an AI coding assistant.
- **`nera_dev_admin`** - the administrative/migration role. `DATABASE_URL` points here. Owns the
  `nera_dev` database and every table in it (see below for why ownership, not just grants, is
  required). Used by `prisma migrate deploy`/`prisma generate`, `seed.ts`, and both bootstrap
  scripts. `NOSUPERUSER NOBYPASSRLS` - it can alter schema and read/write any table, but it does
  not bypass PostgreSQL's own superuser-only protections and is not the same credential as
  `postgres`.
- **`nera_app_role`** - the least-privilege application role `APP_DATABASE_URL` points to (see
  "Application role", below). `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` - can read/write
  business tables (via grants from `nera_dev_admin`, its owner) but can never perform DDL,
  manage roles, or bypass Row Level Security.

**Why `nera_dev_admin` must own the tables, not merely have `GRANT`ed access:** Prisma migrations
run arbitrary DDL (`CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `ENABLE`/`FORCE ROW LEVEL
SECURITY`, etc.). PostgreSQL only allows DDL on an object to its owner or a superuser - a plain
`GRANT SELECT/INSERT/UPDATE/DELETE` (or even `GRANT ALL`) on an existing table never permits
`ALTER TABLE` on it. A role created only with `CREATEDB`/`CREATEROLE` (as `nera_dev_admin` is)
has neither superuser nor ownership by default, so if the database/tables were ever created by a
different role (commonly `postgres`, e.g. during first-time manual setup), `nera_dev_admin` can
authenticate and run `prisma migrate deploy`/`prisma generate` and still get `permission denied`

- not because it lacks a grant, but because it doesn't own the objects. Verified directly against
  this local database during P014: `_prisma_migrations` and all 23 other `public` tables were owned
  by `postgres` while `DATABASE_URL` pointed at `nera_dev_admin`, producing exactly this error.

### Verifying which role is actually active

```sql
SELECT current_user, session_user;
```

Run this via whichever client `DATABASE_URL`/`APP_DATABASE_URL` configures (e.g. `prisma
db execute --stdin` piped this query, or any `$queryRaw` call) to confirm you are connected as
the role you expect, not `postgres` and not the other Nera role.

To check table/database/schema ownership directly (requires a connection that can read
`pg_catalog`, e.g. `nera_dev_admin` or `postgres`):

```sql
SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
SELECT datname, pg_catalog.pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = 'nera_dev';
```

### Repairing ownership/grants safely (superuser-only, one-time or after drift)

If `nera_dev_admin` gets `permission denied for table ...` (including `_prisma_migrations`)
against a database whose tables it does not own, a `postgres`-authenticated session must run
exactly these two statements once, against the `nera_dev` database - **the Owner runs these, not
an AI coding assistant, and the `postgres` password is never shared to run them**:

```sql
-- Run once, connected to the nera_dev database, authenticated as postgres.
ALTER DATABASE nera_dev OWNER TO nera_dev_admin;
REASSIGN OWNED BY postgres TO nera_dev_admin;
```

`REASSIGN OWNED BY postgres TO nera_dev_admin` transfers ownership of every object `postgres`
currently owns _within the connected database_ (every table, sequence, and the `public` schema
itself) to `nera_dev_admin`, in one statement - it does not grant `SUPERUSER`, `BYPASSRLS`, or
any role membership to either Nera role, and it does not touch `nera_app_role`'s separate,
already-correctly-scoped grants at all. After this, re-run the normal
[Local setup sequence](#local-setup-sequence) starting from step 2 (`db:generate`) - migrations,
the RLS role bootstrap, and the app role bootstrap will now succeed because `nera_dev_admin`
genuinely owns what it needs to alter.

**Never** run `GRANT ALL ON ALL TABLES IN SCHEMA public TO nera_dev_admin` (or similar broad
grants) as a substitute - it does not grant DDL rights on existing tables and would leave the
same migration failures unresolved while looking superficially "fixed" for read/write access.
**Never** make `nera_dev_admin` `SUPERUSER` - ownership alone is sufficient and keeps it strictly
less privileged than `postgres`.

## Which client does what

- `prisma` (from `./client.ts`, connects via `DATABASE_URL` as `nera_dev_admin` locally, the
  CI-local Postgres service's own superuser in CI - see `.github/workflows/ci.yml`) - the
  administrative connection. Used **only** by `prisma migrate deploy`, `seed.ts`, and both
  bootstrap scripts. Never the default client for any engine factory, and never `postgres`
  locally (see "Local PostgreSQL role architecture", above).
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

## Troubleshooting: `EPERM` on `query_engine-windows.dll.node` (Windows only)

`prisma generate` (directly, or chained via `db:generate`/`typecheck`/`build`) can fail with:

```
Error:
EPERM: operation not permitted, rename '...\node_modules\.prisma\client\query_engine-windows.dll.node.tmp####' -> '...\node_modules\.prisma\client\query_engine-windows.dll.node'
```

**Root cause, verified directly during P014:** this is never a permissions problem in the
`chmod`/ACL sense - it means some other still-running process has the native query-engine binary
open (Windows will not let a file be replaced while a process holds it loaded in memory). The
usual culprit is a live Next.js dev server (`npm run dev` / `turbo run dev --filter=web`): once
its server process (`node_modules/next/dist/server/lib/start-server.js`) has imported
`@prisma/client` even once, it keeps the engine binary loaded for its entire lifetime.

**Do not** run a broad `taskkill /IM node.exe` or otherwise terminate every Node process on the
machine - other, unrelated Node processes (the IDE, other projects, other tools) may be running
too. Instead:

1. Identify the exact process holding the file:
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, ParentProcessId, CommandLine
   ```
   Look for a `CommandLine` referencing `next/dist/server/lib/start-server.js`, `next dev`, or
   this repository's own `npm run dev`/`turbo run dev --filter=web` - that whole process tree is
   this repository's dev server. Note the deepest child PID (the actual running server) and the
   command that launched the tree.
2. **Only the Owner stops that exact process** (or its owning terminal/task) - not the AI coding
   assistant, and not a blanket process-killing command.
3. Re-run `prisma generate` (or whichever chained command failed). It succeeds once the file is
   released - verified directly: a full computer restart is not required, only stopping the one
   process actually holding the file.

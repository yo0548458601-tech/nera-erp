# @nera/database

Platform database package for Nera.

## Responsibilities

- Prisma schema for platform identity and authorization foundation
- Migration files for the initial platform schema
- Connection validation and development seed infrastructure
- Bootstrap for the restricted PostgreSQL role behavioral RLS tests run under (P012)
- Bootstrap for the least-privilege application database role (P013A)

## Environment

Set DATABASE_URL in the workspace environment before running migrations or validation.
Set APP_DATABASE_URL and APP_DB_PASSWORD before bootstrapping or connecting as the application role (see below).

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

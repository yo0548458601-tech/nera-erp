# @nera/database

Platform database package for Nera.

## Responsibilities

- Prisma schema for platform identity and authorization foundation
- Migration files for the initial platform schema
- Connection validation and development seed infrastructure
- Bootstrap for the restricted PostgreSQL role behavioral RLS tests run under (P012)

## Environment

Set DATABASE_URL in the workspace environment before running migrations or validation.

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

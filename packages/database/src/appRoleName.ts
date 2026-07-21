/**
 * The fixed, repository-controlled name of the least-privilege PostgreSQL
 * role real application traffic connects as (P013A - see
 * `docs/ROADMAP.md`). Both `bootstrapAppRole.ts` (which creates the role and
 * grants) and `README.md` reference this same constant, so the name is never
 * duplicated or allowed to drift.
 *
 * Unlike `RLS_TEST_ROLE_NAME` (`rlsTestRole.ts`, `NOLOGIN`, test-only), this
 * role is `LOGIN`-capable: it is a real, connectable production credential,
 * scoped by `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` to exactly the
 * capability real application code needs and no more.
 */
export const APP_ROLE_NAME = 'nera_app_role';

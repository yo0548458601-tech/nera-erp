/**
 * The fixed, repository-controlled name of the restricted PostgreSQL role
 * used to make behavioral RLS tests trustworthy (P012 - see
 * `docs/ROADMAP.md`). This is a single source of truth: both
 * `bootstrapRlsTestRole.ts` (which creates the role) and the test-only
 * `asRestrictedRole` helper in `@nera/organization-engine` (which switches to
 * it inside a transaction) import this same constant, so the name is never
 * duplicated or allowed to drift.
 *
 * This is infrastructure/ops tooling - the same category as `seed.ts` - not
 * business logic. It is never imported by `getOrganizationContext()` or any
 * other production engine code; only by `bootstrapRlsTestRole.ts` (this
 * package) and by the organization engine's test-only support module.
 *
 * The role is deliberately `NOLOGIN`: it is only ever assumed via
 * `SET LOCAL ROLE` from an already-authenticated superuser connection (see
 * `bootstrapRlsTestRole.ts`), never connected to directly - so there is no
 * new credential to manage or leak.
 */
export const RLS_TEST_ROLE_NAME = 'nera_rls_test_role';

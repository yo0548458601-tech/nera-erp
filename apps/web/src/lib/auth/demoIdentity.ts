/**
 * Real demo identity (P013A - see docs/ROADMAP.md). These UUIDs match the
 * rows `@nera/database`'s seed.ts creates for exactly this purpose - the
 * demo session is still not real authentication (no login flow), but it now
 * resolves against real, seeded database rows instead of placeholder
 * strings ('demo-user', 'org-main') that matched nothing in the database.
 */
export const DEMO_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000000';
export const DEMO_USER_PROFILE_ID = '22222222-2222-2222-2222-222222222222';
export const DEMO_MEMBERSHIP_ID = '33333333-3333-3333-3333-333333333333';
/** The seeded "System Administrator" Role.id (@nera/database's seed.ts) - the demo membership's only role assignment. */
export const DEMO_SYSTEM_ROLE_ID = '11111111-1111-1111-1111-111111111111';

/**
 * The cookie name `SessionContext.tsx` writes the selected organization to
 * (see that file), and Server Components (`contacts/page.tsx`,
 * `contacts/[id]/page.tsx`) read it back from. Deliberately defined here,
 * not in `SessionContext.tsx` itself: that file is `'use client'`, and a
 * Server Component importing a plain constant from a client-boundary module
 * does not reliably resolve to the real value at runtime (verified P013A
 * bug - `cookies().get(SELECTED_ORG_COOKIE_NAME)` silently returned
 * `undefined` even though the cookie was genuinely present, confirmed via
 * `cookies().getAll()`, causing every Contacts page to always render with
 * empty seeded data). This file has no `'use client'` directive and is
 * already safely imported by both client and server code, so it's the
 * correct shared home for this constant.
 */
export const SELECTED_ORG_COOKIE_NAME = 'nera_selected_org_id';

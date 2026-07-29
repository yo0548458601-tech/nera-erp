# P013A Sprint Closing Report

## Sprint Summary

- **Sprint number:** P013A
- **Sprint name:** Entity Persistence & Real Contacts
- **Branch:** p013a-entity-persistence-real-contacts (deleted, local and remote, post-merge)
- **PR:** #2
- **Merge commit:** 24a2fe87e6792d3b53a91e5c1c5cd0c62e93ea15
- **Final commit (pre-merge, on the branch):** 906f84d0811703aff730066b85c49dcd9f06fdc7

# Goal

**Original objective:** Connect the existing Entity Engine to real, tenant-isolated,
audited, event-emitting PostgreSQL persistence, and repoint the Contacts UI from its
in-memory `EntityContext` to that real API — the milestone where "Contacts" stops being a
demo (per `ROADMAP.md`'s original P013 framing).

**Scope:** Entity, PersonProfile, Phone, Email, Address, Note, DuplicateOverrideRecord,
RoleAssignment, and ListViewColumnPreference persistence; a least-privilege application
database role; Server Actions for create/update/archive/restore/contact-method/note/role/
list-view-preference operations; real, server-enforced authorization, audit, and approved
events on every mutation; real browser-verified persistence across reload and session.

**Scope exclusions (explicit, from the start):** Institution application CRUD/management;
any entity-to-institution assignment model; real Identity/Authentication; persisted Role
Definitions and Field Requirements (Customization/Settings engines) — deferred to P013B;
Route Handlers (none introduced — reads are Server Components/plain server functions, writes
are Server Actions); any business module.

# Owner Decisions

1. No Route Handlers in P013A — reads via Server Components/plain async functions, writes
   via Server Actions only.
2. A least-privilege application database role (`nera_app_role`) is the default client for
   every engine factory touching tenant-scoped data; the administrative client is reserved
   for migrations/seed/bootstrap only.
3. List View Preferences persist in P013A, unlike Custom Fields and Field Requirements,
   which explicitly remain in-memory/unpersisted this sprint.
4. Pre-P013A contact editing capability (add/edit/remove phone, email, address) must be
   restored and preserved through the persistence migration, not redesigned.
5. The P013A governance extraction was approved in principle, authorizing creation of
   `docs/NERA_ARCHITECTURAL_INVARIANTS.md` as a new, citation-grounded governance document.
6. Four binding process-rule sections were dictated directly by the Owner and recorded as
   Sections 13–16 of `NERA_ARCHITECTURAL_INVARIANTS.md`: Prompt and Implementation
   Governance, Owner-Controlled Sprint Workflow, Sprint and Chat Continuity, and Knowledge
   Capture Policy.
7. ADR-008 is left unchanged; the unresolved Branch/Department/Institution naming
   reconciliation it flags is tracked in `ROADMAP.md` §9.5 instead of editing the Accepted
   ADR.
8. `TECH_STACK.md` was restructured (not silently corrected) into Current/Target/Open
   sections; `ARCHITECTURE.md` was corrected in place with inline notes, not rewritten.
9. PR #2 merges into `main` via a real merge commit — no squash, no rebase.
10. Both the local and remote feature branches are deleted immediately after a confirmed
    merge.

# Delivered

**Database**

- New tables: `entities`, `person_profiles`, `phones`, `emails`, `addresses`, `notes`,
  `role_assignments`, `duplicate_override_records`, `list_view_column_preferences`
  (migration `20260721090000_add_entity_persistence`).
- Every new table: `ENABLE` + `FORCE ROW LEVEL SECURITY` + an `*_organization_isolation`
  policy, applied in its own creation migration (no retrofit needed, unlike the P004→P012
  precedent).
- Least-privilege `nera_app_role` bootstrapped (`bootstrapAppRole.ts`); `appPrisma`
  (`appClient.ts`) is the default client for every engine factory.
- Real demo identity seeded: `DEMO_ORGANIZATION_ID`, `DEMO_USER_PROFILE_ID`,
  `DEMO_MEMBERSHIP_ID`, `DEMO_SYSTEM_ROLE_ID`.

**Engines**

- `packages/engines/entities`: real persistence repositories — `entityRepository`,
  `personProfileRepository`, `contactMethodRepository` (phones/emails/addresses),
  `noteRepository`, `roleAssignmentRepository`, `duplicateOverrideRepository`,
  `listViewPreferenceRepository`.
- `packages/engines/organization`: `getOrganizationContext` gained UUID-format validation
  (defense-in-depth regression guard).

**Server Actions** (`apps/web/src/lib/actions/`)

- `entityActions.ts` — person create/update/archive/restore, contact-method add/update/
  remove, note add, role assignment, entity listing.
- `listViewPreferenceActions.ts` — get/set/reset effective and personal/system list-view
  columns.
- `requirePermission.ts` — shared, RLS-context-safe permission-check helper.
- `contactMethodReconciliation.ts` — generic add/update reconciliation for phone/email/
  address lists during person edit.

**UI**

- Contacts list and person detail pages repointed from in-memory `EntityContext` to real
  Server Component reads + Server Action writes.
- `PersonFormDialog`'s phone/email/address editors fixed and verified working end-to-end.
- New client components: `ContactsPageClient`, `PersonDetailPageClient`.

**Authorization**

- `checkPermission()` now always runs inside `getOrganizationContext`'s RLS-scoped
  transaction (fixes the RLS-blind pre-check bug).
- `demoSystemUsers` corrected to key on `DEMO_USER_PROFILE_ID` (fixes the stale-identity
  bug), with a regression test asserting the ids never diverge again.

**Audit**

- Every mutation calls `recordAudit()` in the same transaction as its repository write.

**Events**

- `EntityCreated` / `EntityUpdated` / `EntityArchived` published after commit for every
  person mutation.

**Persistence**

- Full contact lifecycle — create, edit, contact-method add/update/remove, notes, role
  assignment, list-view preferences — verified to survive a full page reload and a fresh
  session via repeated real-browser testing (Playwright, installed only temporarily and
  fully removed after each verification pass).

**Documentation**

- `docs/NERA_ARCHITECTURAL_INVARIANTS.md` (new): 16 sections, a Known Pitfalls/Regression
  Guards table, and the four Owner-dictated process sections.
- `docs/ENGINE_MAP.md`: Entity and Configuration/Metadata sections corrected to state real
  P013A persistence, remaining gaps, and current status accurately.
- `docs/ROADMAP.md`: P013 split into P013A (implemented → now merged) and P013B (deferred,
  not yet scheduled); §9 open items expanded with three new tracked gaps.
- `docs/TECH_STACK.md`: restructured into Current Implemented / Approved Target / Open
  Decisions.
- `docs/ARCHITECTURE.md`: corrected in place (not rewritten) for Organization-is-the-tenant
  terminology and the `docs/adr/` (not `docs/decisions/`) ADR location.
- `packages/database/README.md`: documented the `.env`-loading split and the required local
  setup sequence.

**Testing**

- 283 tests passing at final P013A state (up from ~264 at sprint start).
- New live-PostgreSQL regression suites: `checkPermissionRls.test.ts`,
  `contactMethodDraftMapping.test.ts`, `listViewPreferenceInstitutionSwitch.test.ts`,
  `organizationContext.test.ts` additions, `demoUsers.test.ts`, `demoData.test.ts`.
- Real browser verification performed and re-verified across every fix round, not just
  build/typecheck success.

# Bugs Found During Sprint

1. **`checkPermission()` RLS-blindness**
   - _Root cause:_ called directly on `appPrisma` outside any `getOrganizationContext`
     transaction, so its own FORCE-RLS queries silently returned zero rows.
   - _Resolution:_ every `checkPermission` call now runs inside `getOrganizationContext`.
   - _Regression protection:_ live-Postgres test (`checkPermissionRls.test.ts`) proving both
     the bug and the fix.

2. **Stale demo-identity source (`demoSystemUsers`)**
   - _Root cause:_ a parallel demo dataset kept the old placeholder id `'demo-user'` after
     `demoUser.id` was repointed to the real seeded UUID.
   - _Resolution:_ repointed the entry to `DEMO_USER_PROFILE_ID`.
   - _Regression protection:_ `demoUsers.test.ts` asserts the ids never diverge again.

3. **Cookie-constant client/server boundary bug (`SELECTED_ORG_COOKIE_NAME`)**
   - _Root cause:_ exported from a `'use client'` module, imported into a Server Component;
     typechecked and built cleanly but resolved incorrectly at runtime.
   - _Resolution:_ relocated the constant to a neutral, non-`'use client'` module.
   - _Regression protection:_ documented as a binding rule in
     `NERA_ARCHITECTURAL_INVARIANTS.md` §8.3–8.4; verified via real browser reload testing.

4. **Raw UI-draft → Prisma spreading (`order` vs `sortOrder`)**
   - _Root cause:_ a reconciliation callback spread a UI draft directly into a Prisma create
     call, carrying the UI's `order` field where Prisma expected `sortOrder`, plus other
     UI-only shape.
   - _Resolution:_ named, explicitly-typed mapper functions per contact-method type/
     operation, typed directly against `Prisma.*UncheckedCreateInput`/`*UncheckedUpdateInput`.
   - _Regression protection:_ `contactMethodDraftMapping.test.ts` (live Postgres) proving
     both the exact rejection and the fix.

5. **Placeholder non-UUID demo "organization" crashing real queries**
   - _Root cause:_ the organization switcher and a role-assignment dropdown both offered
     pre-P013A placeholder ids (`org-jerusalem`, `org-bnei-brak`) with no real seeded
     `Organization` row, crashing any real query the instant one was selected.
   - _Resolution:_ narrowed every real, persisted selector to `persistedDemoOrganizations`;
     added UUID-format validation to `getOrganizationContext` as defense-in-depth.
   - _Regression protection:_ `demoData.test.ts`, `listViewPreferenceInstitutionSwitch.test.ts`,
     and new `organizationContext.test.ts` cases.

6. **`ListViewPreferenceContext` passing `organizationId` as `institutionId`**
   - _Root cause:_ a copy-paste mistake forwarding the organization id into the institution-
     scope argument, with no real "current institution" feature behind it.
   - _Resolution:_ pass `undefined` for `institutionId` until a real institution-selection
     feature exists.
   - _Regression protection:_ `listViewPreferenceInstitutionSwitch.test.ts` proves
     institution-scope resolution uses the real `institutionId`, never `organizationId`.

# Architectural Changes

- Established the least-privilege database role pattern (`nera_app_role` vs. the
  administrative `prisma` client) as the default for all future engine factories.
- Added UUID-format validation to `getOrganizationContext` — the single choke point every
  persisted query goes through — as a permanent defense against any future placeholder-id
  class of bug.
- Established the canonical typed-mapper pattern (Draft → Prisma input) for contact
  methods, to be reused by any future Draft-shaped write path.
- Consolidated permission-checking into one shared, RLS-context-safe `requirePermission`
  helper.
- Established the `persistedDemoOrganizations` pattern, cleanly separating real,
  database-backed demo data from placeholder data still used by non-persisted UI surfaces.
- Introduced `docs/NERA_ARCHITECTURAL_INVARIANTS.md` as a new governance layer: every rule
  in it traces to the Constitution, an ADR, the Roadmap, an explicit Owner decision, or a
  verified repository invariant/regression guard.
- Formalized the Owner-Controlled Sprint Workflow, Sprint/Chat Continuity, and Knowledge
  Capture Policy as binding process rules for every future sprint.

# Documentation Updated

- **`docs/NERA_ARCHITECTURAL_INVARIANTS.md`** (new) — the citation index and binding
  process-rule document for all future sprints.
- **`docs/ENGINE_MAP.md`** — Entity and Configuration/Metadata sections were stale (claimed
  zero persistence); corrected to match verified repository state.
- **`docs/ROADMAP.md`** — P013 row didn't reflect that P013A had been implemented at all;
  split into P013A/P013B with accurate status, and new open items tracked.
- **`docs/TECH_STACK.md`** — claimed technologies (Next.js 16, React 19, pnpm, CASL, Better
  Auth, MinIO, etc.) that were never installed; restructured to separate fact from
  aspiration.
- **`docs/ARCHITECTURE.md`** — pre-ADR-002 "tenant above organization" language and a stale
  ADR-location reference conflicted with current architecture; corrected in place.
- **`packages/database/README.md`** — the `.env`-loading split (dotenv CWD-relative vs.
  Prisma CLI's own discovery) cost real debugging time this sprint and was undocumented;
  now recorded, along with the required local setup sequence.

# Repository State

- **main:** at commit `24a2fe87e6792d3b53a91e5c1c5cd0c62e93ea15`, working tree clean, local
  `main` verified identical to `origin/main`.
- **CI:** `Validate` check green on the merge commit.
- **Migrations:** 3 total, all applied — `20260713120000_initial_platform_foundation`,
  `20260720120000_add_institutions_and_force_rls`, `20260721090000_add_entity_persistence`.
  None pending.
- **Documentation:** internally consistent as of this closeout (two dedicated review passes
  performed; all identified contradictions resolved).
- **Known deferred work:** Institution CRUD, entity-to-institution assignment decision, real
  authentication, persisted Configuration (P013B), Branch/Department/Institution naming
  reconciliation, the client-bundle packaging defect.

# Open Items

**P013B (Configuration Persistence — not yet scheduled)**

- Persist Role Definitions (`RoleDefinitionsPanel`, currently client-side/in-memory).
- Persist Field Requirements (`FieldRequirementsPanel`, currently client-side/in-memory).

**Future ADR required**

- Entity-to-Institution ownership/assignment decision (`ROADMAP.md` §9.5.2).
- Branch/Department/Institution/`PermissionScope` naming reconciliation (`ROADMAP.md` §9.5.3;
  ADR-008's own unresolved follow-up).
- Database/ORM/authentication/storage provider vendor selection (pre-existing, `ROADMAP.md`
  §9.3 — not new to this sprint).

**Future Roadmap (scoped sprint, no ADR strictly required)**

- Institution application CRUD/management — repository, Server Action, and UI (`ROADMAP.md`
  §9.5.1).
- The workspace barrel/client-bundle packaging defect (`ROADMAP.md` §9.4) — must be resolved
  before any `'use client'` file needs to import a barrel reaching `@nera/database`.
- `ENGINE_MAP.md` §15's documentation/ownership split (list-view preferences implemented
  under `packages/engines/entities` but conceptually documented under Configuration/
  Metadata) — a documentation-organization cleanup, not a functional gap.

# Lessons Learned

- Client-side and server-side permission/identity data must share exactly one source of
  truth — a parallel demo dataset will silently drift and fail closed with no visible error.
- Any bridge from a UI/client draft type to a Prisma call must use named, explicitly-typed
  mappers — never a raw spread, never `as never`/`as any` at that boundary; both were
  present in the bug this sprint found.
- A server-side authorization check must run inside the same transaction/context that
  establishes its RLS session variable — a "pre-check" outside that context can silently
  deny a real, valid actor with no distinguishing error.
- A constant exported from a `'use client'` module can typecheck and build cleanly when
  imported into a Server Component, yet resolve incorrectly at runtime — this class of bug
  is invisible to every automated check except a real browser test.
- Placeholder/demo data that predates real persistence must be audited before a persistence
  sprint ships — an id that was harmless in an in-memory system becomes a real crash the
  moment it reaches a real UUID column.
- Green builds and clean typechecks are not proof a UI fix works — real browser verification
  against a real dev server and a real database is the only reliable check, and this sprint
  found bugs that every other check missed.
- A regression test for a real Prisma/RLS/UUID defect must run against a real PostgreSQL
  connection — a mocked client cannot catch a real schema or type mismatch.
- Live-Postgres test files sharing a hardcoded organization/entity id can race each other
  under parallel execution — don't create test fixtures a test doesn't actually need.
- Documentation drifts out of sync with implementation by default; closing a sprint without
  correcting `ENGINE_MAP.md`/`ROADMAP.md` status leaves the next sprint working from false
  premises about what already exists.
- A governance document is only as useful as its traceability — every rule in
  `NERA_ARCHITECTURAL_INVARIANTS.md` was checked against a real source before being kept, and
  two rules were rewritten mid-sprint when a review found them in apparent tension.

# Recommended Opening Context For Next Sprint

- Read `docs/NERA_ARCHITECTURAL_INVARIANTS.md` in full before doing anything else — it is
  the citation index for everything below and the binding process document for how this
  sprint (and every future one) must run.
- P013A is merged to `main`; its branch is deleted. `main` at
  `24a2fe87e6792d3b53a91e5c1c5cd0c62e93ea15` is the starting point — do not assume any
  further un-merged P013A work exists.
- P013B's scope (per `ROADMAP.md`'s P013A row and `ENGINE_MAP.md` §15) is: persist Role
  Definitions and Field Requirements, currently in-memory/client-only in
  `RoleDefinitionsPanel`/`FieldRequirementsPanel`.
- Do **not** attempt Institution CRUD, entity-to-institution assignment, or real
  authentication as part of P013B unless a new Owner decision explicitly expands scope —
  these are separately tracked, ADR-gated open items (see `ROADMAP.md` §9.5).
- Re-verify the local dev database setup via `packages/database/README.md`'s "Local setup
  sequence" before starting anything — the `.env`-loading split (dotenv's CWD-relative
  lookup vs. the Prisma CLI's own, separate discovery) means `packages/database/.env` is
  required; a repo-root `.env` alone will not work.
- Reuse the established typed-mapper pattern (`contactMethodRepository.ts`) for whatever
  Draft → Prisma translation P013B's custom-field/settings persistence needs.
- Reuse `requirePermission.ts` (already RLS-context-safe) for any new permission checks —
  never re-implement a bare `checkPermission` pre-check outside `getOrganizationContext`.
- Every real mutation must follow: validate → `checkPermission` (inside
  `getOrganizationContext`) → repository call → `recordAudit` (same transaction) → publish
  the approved event (after commit) → `revalidatePath`.
- Follow the Owner-Controlled Sprint Workflow (`NERA_ARCHITECTURAL_INVARIANTS.md` §14):
  Planning → Sprint Boundary Check → Owner Questions → Owner Decisions → Implementation
  Prompt → Implementation → Claude Internal Review → Owner Review → Git Review → CI →
  Explicit Owner Merge Approval → Merge → Branch Cleanup → Sprint Closing Report → New Chat.
- This report is itself the required "previous Sprint Closing Report" input for that
  workflow — carry it forward into the P013B chat.
  P013A is fully closed: merged, branch-cleaned, and documented. Not starting P013B. Waiting for Owner.

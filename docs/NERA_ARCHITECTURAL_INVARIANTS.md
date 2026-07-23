# NERA_ARCHITECTURAL_INVARIANTS.md

**Status:** Draft — governance extraction approved in principle by the Owner (P013A); this
document itself is pending final Owner sign-off before being treated as a governance
document with the same standing as the Constitution/ADRs/Roadmap.

**Precedence:** This document does not outrank `NERA_CONSTITUTION.md`, `PRODUCT_VISION.md`,
`ROADMAP.md`, `ENGINE_MAP.md`/`MODULE_MAP.md`, or `docs/adr/*` — see Section 1. It exists to
collect, cite, and make searchable what those documents (and the verified repository state)
already establish, plus the process rules the Owner has directed during P013A. It does not
introduce new architecture. Every rule below is traced to an existing source: the
Constitution, an Accepted ADR, the Roadmap, an explicit Owner decision recorded during
P013A, or a verified repository invariant/regression guard. Where no such source exists,
the rule is noted as such rather than invented.

---

## 1. Governance Hierarchy

1.1. **Authoritative documents, highest precedence first** (source: `NERA_CONSTITUTION.md` §13):

1. `docs/NERA_CONSTITUTION.md`
2. `docs/PRODUCT_VISION.md`
3. `docs/ROADMAP.md`
4. `docs/ENGINE_MAP.md` / `docs/MODULE_MAP.md`
5. `docs/adr/*.md` (the single canonical ADR directory — `docs/decisions/` is redirect stubs only, no independent content)
6. Legacy foundation documents: `docs/PROJECT_VISION.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/TECH_STACK.md`, `docs/CORE_PLATFORM_BLUEPRINT.md` — valid only for details not restated or superseded above.
7. `docs/NERA_ARCHITECTURAL_INVARIANTS.md` (this document) — a citation index and process record, not itself a source of new architecture.
   — **Status: Locked.**

1.2. **Conflict resolution:** where a lower document conflicts with a higher one, the higher one wins outright; the conflict should be resolved by updating or retiring the lower document, never by silent divergence (`NERA_CONSTITUTION.md` §13). — **Locked.**

1.3. **A major architectural change requires an ADR at status `Accepted` before implementation** — a new tenant/security boundary, a provider/stack change, a new Core Engine, or a change to a Constitution principle (`NERA_CONSTITUTION.md` §3.10, §9.7, §12). — **Locked.**

1.4. **A coding agent (Claude or otherwise) may research and recommend an architectural decision. It may not resolve an unresolved one unilaterally.** Where repository state, prior documentation, and new instructions disagree, the agent's job is to surface the conflict precisely, not pick a side (`NERA_CONSTITUTION.md` §9.8, §12; `docs/adr/README.md`). — **Locked.**

1.5. **Outdated documentation is a defect.** When a change makes a canonical document inaccurate, updating it is part of the task, not a follow-up (`NERA_CONSTITUTION.md` §9.6). — **Locked.**

1.6. **When to stop and ask the Owner:** (a) a requested implementation conflicts with the Constitution (§1); (b) a task requires resolving an item listed as "Still Open" in `ROADMAP.md` §9 or a "Follow-up needed" note in an ADR; (c) a fix would require a new tenant/security boundary, provider choice, or Core Engine; (d) two authoritative documents disagree and neither is unambiguously higher-precedence for the specific fact in question. — **Locked.**

---

## 2. Scope and Sprint Boundary Rules

2.1. **No scope expansion without approval.** Every task is Objective/Scope/Constraints/Deliverables/Acceptance-Criteria bounded; work outside approved scope requires going back for approval (`NERA_CONSTITUTION.md` §9.2). Claude may not invent product requirements, make architectural decisions alone, expand scope, add unrequested features, or modify unrelated files (`NERA_CONSTITUTION.md` §8.3). — **Locked.**

2.2. **Deferred capabilities stay deferred until their own sprint.** Institution CRUD, real Identity/Authentication, entity-to-institution assignment, Document/Workflow/Search/Reporting engines, and every Milestone 3+ business module are explicitly deferred — see `ROADMAP.md` §3–§7. A sprint fixing a bug in one of these areas does not implicitly build the missing piece. — **Locked** as a rule; the specific deferred list is **Sprint-specific** (changes as sprints land).

2.3. **Roadmap changes require updating `ROADMAP.md` as part of the task that changes reality**, per §1.5 above — not a silent drift between what the roadmap claims is "not yet delivered" and what the repository actually contains. — **Locked.**

2.4. **ADR changes require the owner-approval status transition** (`Proposed` → `Accepted`), never a quiet edit to an existing Accepted ADR's Decision section. A new decision that changes an existing ADR's conclusion is a new ADR that supersedes the old one, per `docs/adr/README.md`'s status vocabulary. — **Locked.**

2.5. **A sprint branch's own fixes must stay inside the reported defect's blast radius.** Verified P013A precedent: when fixing the institution-switch crash, the fix touched every real (persisted) code path reachable by the same bad data (the organization switcher **and** `PersonRolesCard`'s role-assignment dropdown) but explicitly left the two non-persisted demo panels (`RoleDefinitionsPanel`, `FieldRequirementsPanel`) untouched, because they cannot reach Prisma. — **Regression Guard, Locked**, generalized in Section 13.5 below.

---

## 3. Tenant and Organization Isolation

3.1. **Organization is the tenant and the sole security boundary.** RLS is keyed on `organization_id`, never on anything else (`NERA_CONSTITUTION.md` §6.3, §7.1; ADR-002 Decision item 1). — **Locked.**

3.2. **Institution is an optional business hierarchy strictly below Organization** — never an alternative or replacement tenant boundary; an Organization may have zero or more Institutions (ADR-002 Decision item 2–3; `ENGINE_MAP.md` §3). — **Locked.**

3.3. **`institution_id`, wherever it exists, is never trusted alone.** Every access path using it must also validate it belongs to the caller's `organization_id`, via `assertInstitutionBelongsToOrganization(institutionId, organizationId)` (ADR-002 Decision item 5; `packages/engines/organization/src/institutionOwnership.ts`, real and tested). — **Locked.**

3.4. **A placeholder or institution-labeled identifier must never enter a persisted `organizationId`/tenant-context parameter.** Verified P013A regression: the demo "current organization" switcher and the role-assignment organization-scope dropdown both fed a non-UUID placeholder (`org-jerusalem`/`org-bnei-brak`) into real `organizationId` parameters, crashing every downstream Prisma query with a raw UUID-parse error. Fixed by narrowing every real, persisted selector to `persistedDemoOrganizations` (only entries backed by a real seeded `Organization` row). — **Regression Guard, Locked.**

3.5. **RLS is enabled _and_ `FORCE`d on every tenant-scoped table**, not merely enabled. Verified: every table from the P004 migration was retrofitted with `FORCE ROW LEVEL SECURITY` in P012; every table added by P013A (`entities`, `person_profiles`, `phones`, `emails`, `addresses`, `notes`, `role_assignments`, `duplicate_override_records`, `list_view_column_preferences`) has both `ENABLE` and `FORCE ROW LEVEL SECURITY` applied in its own creation migration, plus an `*_organization_isolation` policy — no retrofit needed. — **Locked.**

3.6. **A PostgreSQL superuser/`BYPASSRLS` connection is never protected by RLS, `FORCE` or not** — a documented Postgres limitation, not a policy gap. Tests that need to prove isolation must use a dedicated, repository-controlled, `NOLOGIN`/`NOSUPERUSER`/`NOBYPASSRLS` restricted role via `SET LOCAL ROLE`, composed around `getOrganizationContext`'s callback from the _outside_ — never inside `getOrganizationContext` itself (`ENGINE_MAP.md` §3; `packages/engines/organization/src/testSupport/`). — **Locked.**

3.7. **`getOrganizationContext(context, work)` is the one real entry point every persisted query goes through**, and it validates its input: non-empty string, and (verified P013A addition) a well-formed UUID — added specifically because a non-UUID `organizationId` previously surfaced as a raw, low-level Prisma/Postgres parser error inside whichever repository query ran first, instead of one clear error at the boundary (`packages/engines/organization/src/organizationContext.ts`). — **Regression Guard, Locked.**

3.8. **Application role rules:** real application traffic connects as `nera_app_role` — `LOGIN`-capable, `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`. The administrative `prisma` client (table-owner/superuser, `DATABASE_URL`) is used _only_ by `prisma migrate deploy`, `seed.ts`, and the two bootstrap scripts — never as the default client for any engine factory (`packages/database/README.md`). `appPrisma` (`APP_DATABASE_URL`) is the default client for every engine factory touching tenant-scoped data. — **Locked.**

3.9. **ADR-002 authorizes the `institution_id` _mechanism_ in general — this is distinct from deciding _which_ tables should use it.** Every tenant-scoped table carries `organization_id` (mandatory) and, optionally, `institution_id` (additive only, never trusted alone — §3.3). No schema currently has an `institution_id` column on any table, since none has yet needed institution-level scoping (`NERA_CONSTITUTION.md` §7.7; `ENGINE_MAP.md` §3). **What ADR-002 already settles, requiring no new ADR:** _if_ a future sprint adds `institution_id` to some table, the shape of that column and its ownership-validation requirement (`assertInstitutionBelongsToOrganization`) are already decided — that part is mechanical, not a new architectural question. **What ADR-002 does _not_ settle, and does require its own future ADR:** _whether_ any specific table — Entity in particular — should gain that column at all. That is a real product/architecture decision, not implied by ADR-002's general authorization of the mechanism. See §9.2 below for the Entity-specific instance of this still-open decision, and `ROADMAP.md` §9.5.2 for the canonically tracked item. — **Current** (the mechanism's shape; true today, no ADR needed to reuse it). The _decision to apply it to Entity_ is separately tracked as **Open/unresolved** — see §9.2.

3.10. **Institution CRUD/management does not exist.** Institution rows exist today only via administrative-client test fixtures (`prisma.institution.create(...)` in test files), never through a repository, Server Action, or UI. This is a genuine capability gap, not a bug — verified directly (no non-test `institution.create`/`institution.update` call exists anywhere in the repository). — **Open/unresolved** (a future sprint's job, not scheduled).

---

## 4. Database and Prisma Rules

4.1. **UUID conventions:** primary keys are UUIDs, using Prisma's default `uuid()` (UUIDv4) — the repository's actual implemented strategy is the source of truth today; UUIDv7 is a candidate future improvement requiring its own ADR and migration analysis (`NERA_CONSTITUTION.md` §7.3; `ROADMAP.md` §9.1.3). — **Current** (ADR required to change).

4.2. **Naming conventions:** English, `snake_case`, tables pluralized (`NERA_CONSTITUTION.md` §7.2; `ARCHITECTURE.md` §18 — consistent between the two, no conflict). — **Locked.**

4.3. **Every business table includes `created_at`/`updated_at`; soft delete (`deleted_at`) is the default deletion strategy; a hard delete is an explicit, authorized, audited exception, never the default** (`NERA_CONSTITUTION.md` §7.4). Verified consistently applied: `Institution`, `Entity`, `Phone`/`Email`/`Address` all carry `deletedAt`/`deletedByUserId`, never a hard-delete repository method. — **Locked.**

4.4. **Foreign keys are enforced and default to `RESTRICT`; FK columns are always indexed** (`NERA_CONSTITUTION.md` §7.5). Verified: every P013A relation (`Entity → Organization`, `Phone/Email/Address → Entity`, etc.) uses `onDelete: Restrict` with an index on the FK column. — **Locked.**

4.5. **Migration rules:** a migration that adds RLS to a new table must `ENABLE` and `FORCE` it in the _same_ migration, with its `*_organization_isolation` policy, not as a later retrofit (verified P013A practice, improving on the P004→P012 retrofit precedent). — **Locked** as a going-forward practice (Sprint-specific until formalized in an ADR/Constitution amendment).

4.6. **Two Prisma clients, two purposes, never interchanged:** `prisma` (administrative, `DATABASE_URL`) for migrations/seed/bootstrap only; `appPrisma` (least-privilege, `APP_DATABASE_URL`, `nera_app_role`) as the default for every engine factory (`packages/database/README.md`). — **Locked.**

4.7. **Forbidden persistence pattern: raw UI-Draft → Prisma spreading.** Verified, twice-regressed P013A bug: a reconciliation callback forwarded `{...draft, entityId, organizationId}` directly into `contactRepo.phones.add()`, carrying the UI's `order` field (Prisma expects `sortOrder`), the client-generated `id`, and other UI-only shape — Prisma rejected it outright (`Unknown argument \`order\``) on create, and would have silently dropped fields on update. Fixed with named, per-type mapper functions (`mapPhoneDraftForCreate`/`ForUpdate`, and the email/address equivalents) typed directly against `Prisma.*UncheckedCreateInput`/`*UncheckedUpdateInput`. **A draft object must never be spread directly into a Prisma call.** — **Regression Guard, Locked.**

4.8. **Forbidden: `as any` / `as never` across a persistence boundary as a substitute for a correct type.** The `order`/`sortOrder` bug was made possible specifically because every affected call site used `as never`, silencing the compiler exactly where it would have caught the mismatch. The fix's mapper functions are typed so no cast is needed at any of the corrected call sites — verified by a clean `tsc --noEmit` with zero `as never` remaining on the touched lines. `as never`/`as any` at a persistence boundary is a defect indicator, not an acceptable escape hatch. — **Regression Guard, Locked.**

4.9. **Typed mapper requirement:** any function translating a client/UI draft type into a repository/Prisma input type must name every field explicitly and be typed against the real `Prisma.*UncheckedCreateInput`/`*UncheckedUpdateInput` (or an equally concrete, non-`any` type) — never `Omit<Prisma.X, ...>` alone when the omitted union still leaks Prisma's `FieldUpdateOperationsInput` variants into a caller expecting a plain value. — **Regression Guard, Locked.**

4.10. **A repository's `add`/`create` path must never forward a client-generated `id`.** The server always lets Prisma generate the real id; the caller re-fetches the persisted record afterward. Verified as the consistent, correct pattern across all three P013A create call sites once fixed. — **Locked.**

---

## 5. Authorization Rules

5.1. **`checkPermission()` is the one real, server-side authorization decision function** — Prisma-backed, resolving `MembershipRole → RolePermission → allow/deny`; deny always wins on conflict; default deny when no rule matches (ADR-008; `ENGINE_MAP.md` §2; P011). — **Locked.**

5.2. **A client-side permission check (`resolveEffectivePermission()`, `useMyPermission`) is a UI hint only, never a security boundary** — the two are deliberately separate functions, never wired together (`NERA_CONSTITUTION.md` §6.1; `ENGINE_MAP.md` §2). — **Locked.**

5.3. **`checkPermission()` must always run inside `getOrganizationContext`'s RLS-scoped transaction, never as a bare pre-check outside one.** Verified P013A production bug: `requirePermission()` called `checkPermission` directly on `appPrisma` (no RLS session variable set), so its own FORCE-RLS queries (`organization_memberships`, `membership_roles`, `permissions`, `role_permissions`) silently returned zero rows, producing a clean `deny/'unknown-membership'` for a real, valid, seeded membership — indistinguishable from a real deny without inspecting the stack trace. Fixed by wrapping every `checkPermission` call in `getOrganizationContext`. — **Regression Guard, Locked.**

5.4. **Every demo/session identity constant must have exactly one source of truth, never a parallel, independently-maintained copy.** Verified P013A production bug: `demoSystemUsers` (`demoUsers.ts`, used only by the client-side `useMyPermission` UI hint) was a _separate_ dataset from `demoUser`/`demoIdentity.ts`, still keyed on the stale placeholder `'demo-user'` after `demoUser.id` was repointed to the real seeded UUID — silently defaulting every `useMyPermission(...)` check app-wide to deny, with no thrown error. Fixed by repointing the stale entry and adding a regression test asserting `demoUser.id === DEMO_USER_PROFILE_ID`. — **Regression Guard, Locked.**

5.5. **Organization scoping in authorization is explicit, never implicit.** `checkPermission()` takes an explicit `organizationId` and never relies on RLS for its own correctness (every query carries its own filter) — RLS is a second, independent enforcement layer, not a substitute (`ENGINE_MAP.md` §2, §6.3). — **Locked.**

5.6. **A System Administrator may bypass business permissions, but every such action remains fully audited and reviewable — nothing an administrator does is invisible** (`NERA_CONSTITUTION.md` §6.5; ADR-008 "System Administrator"). — **Locked.**

5.7. **User-level permission overrides/explicit denials are named in ADR-008 but not implemented** — no table exists; P011 implements only the Organization/Role slice of ADR-008's model. — **Open/unresolved** (not this sprint's job).

5.8. **The `Branch`/`Department` hierarchy (ADR-008) vs. `Institution` (ADR-002) vs. the pre-existing `'institution'` `PermissionScope` enum value (which currently means Organization, not a real Institution) are three different naming schemes for related-but-unreconciled concepts.** ADR-008's own follow-up explicitly defers this reconciliation to a future ADR; `ENGINE_MAP.md` §2's P011 reconciliation note is narrow and explicitly does not resolve it. This document does **not** resolve it either — see `ROADMAP.md` §9 for the tracked open item. — **Open/unresolved**, requires its own future ADR.

---

## 6. Audit Rules

6.1. **`audit_logs` is a single, shared, append-only writer — no engine or module maintains a parallel audit mechanism** (`NERA_CONSTITUTION.md` §7.6, §12; `ENGINE_MAP.md` §5). — **Locked.**

6.2. **`recordAudit(input)` (`@nera/audit-engine`) is Prisma-backed and real**, exposing no update/delete in its public API — audit immutability is currently enforced only at the application layer; no database-level trigger/`REVOKE` immutability exists yet, a documented gap, not a claimed guarantee (`ENGINE_MAP.md` §5). — **Locked** (the write contract); **Open/unresolved** (DB-level immutability enforcement).

6.3. **Every meaningful mutation calls `recordAudit()` explicitly, in parallel with any event it also publishes — not through the event bus.** `business-event-bus → audit` is the accepted dependency direction; Audit never subscribes to bus events, to avoid a dependency cycle (`ENGINE_MAP.md` §5, §16; P010 decision, enforced by a registry regression test). — **Locked.**

6.4. **Every P013A Server Action mutation follows: validate → `checkPermission` → `getOrganizationContext` (one transaction) → repository call → `recordAudit` (same transaction) → publish the approved event (if any), after commit → `revalidatePath`.** Verified as the consistent pattern across `entityActions.ts`, `listViewPreferenceActions.ts`. See Section 13.2 for this promoted to a binding rule. — **Locked** (the sequence, as implemented since P013A).

6.5. **No read/query API for `audit_logs` exists yet** — deliberately deferred, since a permission-aware read could not be honestly built before P011's real `checkPermission()` existed (`ENGINE_MAP.md` §5). — **Sprint-specific**, unblocked as of P011; still not built.

---

## 7. Event Rules

7.1. **The Business Event Bus is in-process, non-persistent, V1** — no external broker, no persistence, no retries, no background worker (`NERA_CONSTITUTION.md`; `ENGINE_MAP.md` §16; P010). — **Locked.**

7.2. **`publish()` awaits each subscriber sequentially, in registration order, for deterministic delivery; a failing subscriber never blocks others** — reported via a structured `failures` list in `PublishResult`, never thrown (`ENGINE_MAP.md` §16). — **Locked.**

7.3. **No `EventBusSubscriberFailed` (or equivalent) event is re-published onto the same bus on subscriber failure** — a deliberate P010 decision to avoid recursion risk; `publish()`'s own return value is the answer to observability (`ENGINE_MAP.md` §16). — **Locked.**

7.4. **Only approved, already-implemented events are published; no engine invents a private ad-hoc event name for something the platform already models** (`EntityCreated`, etc., per `ENGINE_MAP.md`'s per-engine "Events emitted" lists). Verified P013A practice: `entityActions.ts` publishes exactly `EntityCreated`/`EntityUpdated`/`EntityArchived` after commit, never before. — **Locked.**

7.5. **Forbidden:** publishing an event before its transaction commits (risk of a subscriber acting on data that gets rolled back); embedding more data in a payload than the least-trusted possible subscriber should see (an ID to re-fetch, permission-checked, is preferred) (`ENGINE_MAP.md` §16). — **Locked.**

---

## 8. Server Architecture

8.1. **No Route Handlers were introduced by P013A.** Reads are plain async functions called from Server Components; writes are Server Actions (`'use server'`), also callable directly from client event handlers. This is the explicit, Owner-reviewed P013A architectural resolution to the "Server Component read blocker." — **Sprint-specific** (P013A's own scoping decision).

8.2. **Every export of a `'use server'` file must itself be an async Server Action.** Shared, non-Server-Action helper logic (permission checks, reconciliation, draft-mapping) lives in its own plain module, imported by the Server Action file, never inlined where it would violate this Next.js constraint. Verified: `requirePermission.ts`, `contactMethodReconciliation.ts` both exist as separate plain modules specifically for this reason. — **Locked** (a framework constraint, treated as binding).

8.3. **A plain constant exported from a `'use client'` module must never be imported directly into a Server Component.** Verified P013A regression: `SELECTED_ORG_COOKIE_NAME`, exported from `SessionContext.tsx` (`'use client'`) and imported into two Server Components, typechecked and built cleanly but resolved to a value at runtime that made `cookies().get(...)` silently return `undefined`. Fixed by relocating the constant to a neutral, non-`'use client'` module (`demoIdentity.ts`). — **Regression Guard, Locked.**

8.4. **Cookie/session-derived values used by a Server Component must originate from a neutral module, never a `'use client'` module**, per 8.3. — **Locked.**

8.5. **The known Next.js/webpack packaging defect remains open and unresolved:** a workspace package barrel that statically reaches `@nera/database` fails to build under `apps/web`'s client-side webpack bundle once a `'use client'` file imports that barrel (`ROADMAP.md` §9.4). Verified still present: `@nera/authorization-engine`'s barrel still deliberately does not re-export `checkPermission`, citing this exact defect, because `AuthorizationContext.tsx` (`'use client'`) already imports that same barrel. P013A's Server Actions reach `@nera/database` through `@nera/entity-engine`'s barrel successfully only because no `'use client'` file imports that barrel — the defect is scoped to client bundles, not Server Actions. — **Open/unresolved**, no ADR needed (packaging defect, per `ROADMAP.md` §9.4 item 2), but must be fixed before any `'use client'` file needs to import a barrel reaching `@nera/database`.

8.6. **Real Identity/Authentication remains unbuilt.** `demoAuth.ts` is an explicit, documented stub. Every Server Action's "actor" is the fixed demo identity (`DEMO_USER_PROFILE_ID`/`DEMO_MEMBERSHIP_ID`), matching real, seeded database rows — not real authentication. — **Locked** (as an accurate current-state description); replacing it is **Open/unresolved**, blocked on a future provider ADR (`ROADMAP.md` §9.3).

---

## 9. Entity Architecture

9.1. **Entity, PersonProfile, Phone, Email, Address are Organization-scoped only.** Every one carries `organization_id`; none carries `institution_id`. Verified directly against `schema.prisma`. Contacts are Organization-wide, not Institution-scoped, today. — **Current** (true today; a future entity-to-institution decision is required to change it, and none has been made or implemented — see 9.2).

9.2. **No entity-to-institution ownership model has been approved or implemented.** Confirmed via direct code search: zero non-test code paths write to the `institutions` table; no `OrganizationEntity`/entity-institution join exists. **This is not resolved by ADR-002.** ADR-002 authorizes the general `institution_id` mechanism (§3.9) — it does not decide that Entity specifically should use it. Whether Entity should ever gain an `institution_id` column is a separate, real product/architecture question that requires its own future ADR (parallel to ADR-002's own precedent) once there is a real, justified need — not a schema change slipped into an unrelated bug fix. See `ROADMAP.md` §9.5.2 for the canonically tracked item. — **Open/unresolved.**

9.3. **The Entity repository boundary is per-model, generic-over-client, defaulting to `appPrisma`** — `createEntityRepository`, `createContactMethodRepository`, `createListViewPreferenceRepository`, `createNoteRepository`, `createRoleAssignmentRepository`, `createDuplicateOverrideRepository`, each accepting an optional injected client for tests, defaulting to the least-privilege connection in production. — **Locked.**

9.4. **UI model boundary: a client-editable "Draft" type (`PhoneDraft`, `EmailDraft`, `AddressDraft`) is never assumed to be repository-input-shaped.** Field names differ deliberately (`order` in the UI/domain model vs. `sortOrder` in Prisma) and must always be translated through a named mapper — see §4.7–4.9. — **Locked.**

9.5. **Contact-method mapping is explicit for both create and update, per type, and shared across every call site** (initial person creation, the reconciliation add/update path used during edit, and the standalone `addContactMethodAction`) — one canonical mapper per type/operation, not independently hand-written per call site. — **Locked.**

9.6. **List View Preference semantics: `user → role → institution → system → built-in default`, in that precedence order** (`ENGINE_MAP.md` §15; `listViewPreferenceRepository.ts`'s `getEffectivePreference`, verified by test). `targetId` is heterogeneous by scope: a `UserProfile.id` for `'user'`, a `Role.id` for `'role'`, an `Institution.id` for `'institution'`, `null` for `'system'`. `organizationId` must never be copied into the `institutionId`/`targetId` slot. — **Locked.**

9.7. **"Reset" of a list-view preference means deleting the row for that scope/target/screen, not a flag** — the resolution cascade then naturally falls through to the next broader scope. — **Locked.**

9.8. **Contacts persistence is real and durable.** Entity, PersonProfile, Phone, Email, Address, Note, DuplicateOverrideRecord, RoleAssignment, and ListViewColumnPreference all persist to real PostgreSQL tables via Prisma and survive a full page reload and a fresh session — verified by direct browser testing across multiple P013A rounds (create → reload → edit → reload → remove/soft-delete → reload). This is not yet merged to `main` — see `ROADMAP.md` P013A row. — **Sprint-specific** (accurate as of the P013A branch; becomes **Current** on merge).

---

## 10. Testing Rules

10.1. **Business rules, permissions, workflows, automation, and tenant isolation require dedicated test coverage, not incidental coverage** (`NERA_CONSTITUTION.md` §8.4). — **Locked.**

10.2. **Unit tests against a fake/mocked client are appropriate for pure logic and business-rule resolution** (e.g. `listViewPreferenceRepository.test.ts`'s cascade tests, `contactMethodRepository.test.ts`'s primary-clearing logic) — but a fake client accepts any shape and **cannot** catch a real Prisma schema/argument mismatch. — **Locked** as a known limitation, not a defect in those tests.

10.3. **A regression proving a real Prisma-level defect (a rejected argument, a UUID-format crash) must run against the real `@prisma/client`, not a mock** — verified pattern: `checkPermissionRls.test.ts`, `contactMethodDraftMapping.test.ts`, `listViewPreferenceInstitutionSwitch.test.ts`, `organizationContext.test.ts`'s live-RLS block all use `appPrisma`/`prisma` directly, with a local, duplicated (not imported) `withOrganizationContext` helper per package, to avoid adding a cross-package test-only dependency edge. — **Regression Guard, Locked.**

10.4. **RLS isolation can only be proven behaviorally, against a real PostgreSQL connection, using the dedicated restricted role** — never asserted by code review alone, never faked (`ENGINE_MAP.md` §3; `organizationContext.test.ts`'s "behavioral RLS isolation" block). — **Locked.**

10.5. **A regression test must reproduce the exact reported defect before proving the fix** — verified practice across all P013A bug-fix rounds. — **Locked** as a working practice this session; formalized as a binding rule in Section 13.6.

10.6. **Browser verification is required for any UI-reachable bug fix, using the real dev server, the real local Postgres database, and a real (temporarily-installed, always fully removed afterward) browser automation tool — never `npm run build` success alone as a correctness proxy.** — **Locked** as an Owner-enforced practice; formalized as a binding rule in Section 13.8.

10.7. **CI must run the exact same steps `npm run validate` runs locally, in the same order, so a CI failure is always locally reproducible** (`.github/workflows/ci.yml`'s own header comment; `ROADMAP.md` P009 exit criterion). — **Locked.**

10.8. **CI installs from the committed lockfile only (`npm ci`), never `npm install`**, specifically because lockfile drift was once the root cause of intermittent failures (`ci.yml`; `ROADMAP.md` P009). — **Locked.**

10.9. **A live-Postgres test file's fixture setup must not race another live-Postgres test file touching the same hardcoded organization/entity.** Verified regression discovered and fixed this session: a new test file's unnecessary `beforeAll`/`afterAll` entity-fixture setup collided with an existing test file's own fixture under vitest's parallel file execution, producing a non-deterministic unique-constraint failure. Fix: don't create fixtures a test doesn't actually need; when a shared organization id must be used, keep any created/mutated state scoped and cleaned up within the same test via `try/finally`. — **Regression Guard, Locked.**

---

## 11. Git and CI Rules

11.1. **`main` always remains stable; nothing is committed to `main` without explicit Owner approval** (`NERA_CONSTITUTION.md` §9.5). — **Locked.**

11.2. **Every sprint follows Planning → Execution → Review → Approval → Commit; no sprint is complete until reviewed and committed** (`NERA_CONSTITUTION.md` §9.1). See Section 14 for the full, P013A-specific expansion of this lifecycle. — **Locked.**

11.3. **Commits are small, meaningful, one logical change, `type: short description`** (`NERA_CONSTITUTION.md` §9.4). — **Locked.**

11.4. **A PR's CI must be green before Owner review is meaningful** — verified, enforced pattern this entire P013A session: every fix round pushed to the existing branch, waited for the `Validate` GitHub Actions check to report `conclusion: success` (polled via the public check-runs API, not assumed), before reporting completion. — **Locked**, formalized in Section 13.10.

11.5. **Merge requires explicit Owner approval; an agent never merges on its own judgment**, even after green CI and a clean report (`NERA_CONSTITUTION.md` §9.5). — **Locked**, formalized in Section 13.11.

11.6. **Diagnostic/temporary artifacts (repro scripts, screenshots, a temporarily-installed test-only dependency like Playwright) must be fully removed before a commit** — verified via `git status --short` checks and `npm ls <package>` before every commit this session. — **Locked** as practiced.

11.7. **Branch cleanup** occurs only after Owner-approved merge, as its own lifecycle phase — see Section 14. Timing/criteria for closing a long-lived feature branch before merge (e.g. if a sprint stalls) remain unresolved. — **Open/unresolved.**

---

## 12. Known Pitfalls and Regression Guards

| #   | Verified failure                                                                                                                                                                                                                                                                                                              | Rule that prevents it                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `checkPermission()` called on `appPrisma` outside any `getOrganizationContext` transaction — its own FORCE-RLS queries silently return zero rows, producing an indistinguishable-from-real `deny`.                                                                                                                            | §5.3 — every permission check must run inside `getOrganizationContext`.                                                                                                                     |
| 2   | `demoSystemUsers` kept a stale placeholder id (`'demo-user'`) after `demoUser.id` was repointed to a real UUID, silently defaulting every client-side `useMyPermission` check to deny.                                                                                                                                        | §5.4 — exactly one source of truth per demo identity constant, with a regression test asserting the ids stay equal.                                                                         |
| 3   | `SELECTED_ORG_COOKIE_NAME` exported from a `'use client'` module and imported into a Server Component — typechecked, built, and broke silently at runtime.                                                                                                                                                                    | §8.3/§8.4 — cookie/session constants live in a neutral module only.                                                                                                                         |
| 4   | A reconciliation callback raw-spread a UI draft (`order`, client `id`, other UI-only shape) directly into `contactRepo.phones.add()`, throwing `Unknown argument \`order\`` on create and silently mis-mapping on update.                                                                                                     | §4.7/§4.9/§9.4–9.5 — explicit, named, concretely-typed mappers per type/operation, shared across every call site.                                                                           |
| 5   | The `order` (UI/domain) vs. `sortOrder` (Prisma column) naming mismatch specifically — the proximate trigger of #4.                                                                                                                                                                                                           | §4.7 and §9.4 — a Draft type's field names are never assumed to match the persistence column names.                                                                                         |
| 6   | `dotenv`'s CWD-relative `.env` lookup (used by plain TS scripts) vs. the Prisma CLI's own separate, schema-adjacent `.env` discovery — two genuinely different mechanisms inside the same package, neither reading the repo root.                                                                                             | Documented in `packages/database/README.md` (Environment section).                                                                                                                          |
| 7   | The demo "current organization" switcher (and `PersonRolesCard`'s role-assignment scope dropdown) offered two placeholder pseudo-organizations (`org-jerusalem`, `org-bnei-brak`) with no real seeded `Organization` row, crashing any real, persisted query with a raw Prisma UUID-parse error the instant one was selected. | §3.4/§3.7 — only `persistedDemoOrganizations` (real-UUID-backed) may enter a real, persisted `organizationId`; `getOrganizationContext` also now validates UUID format as defense in depth. |
| 8   | `ListViewPreferenceContext.tsx` passed `organizationId` again as the `institutionId` argument to `getEffectiveListViewColumnsAction` — a copy-paste mistake with no real "current institution" feature behind it.                                                                                                             | §9.6 — institution-scope resolution receives a real `institutionId` or `undefined`, never `organizationId`.                                                                                 |
| 9   | A new live-Postgres test file's unnecessary fixture setup (`beforeAll`/`afterAll` creating/deleting an `Entity`) raced an existing test file's own fixture under the same hardcoded organization id, producing a non-deterministic unique-constraint failure only when both files ran together.                               | §10.9 — don't create fixtures a test doesn't need; scope and clean up any needed state within the same test.                                                                                |
| 10  | An over-broad Playwright locator (`getByRole('button', {name: 'הסר כתובת'})` without `exact: true`) substring-matched a _different_ button (`'הסר כתובת דוא"ל'`), making a correct application behavior look like a data-integrity bug during verification.                                                                   | Test-authoring discipline: always pass `exact: true` for Hebrew button-label locators with a shared prefix.                                                                                 |

---

## 13. Prompt and Implementation Governance

Binding rules for every future implementation prompt and every implementation session, regardless of sprint. **Source: Owner Decision (P013A Documentation Closeout).** All entries below are **Status: Locked** unless noted otherwise.

13.1. **No assumptions.** Every claim about the repository's current state (a file's contents, a dependency's presence, a table's columns, a document's current wording) must be verified by direct inspection before being acted on or reported — never inferred from memory, a prior session's summary, or a document's stated intent.

13.2. **Perform a Sprint Boundary Check before implementation.** Confirm the requested work's scope against `ROADMAP.md`'s current milestone/sprint boundaries, `ENGINE_MAP.md`'s current (re-verified, not assumed) status for every engine touched, and `docs/adr/README.md`'s index for any relevant Accepted/open ADR, before writing any code.

13.3. **Surface unresolved Owner decisions before writing code.** If implementing the request would require resolving an item listed as open in `ROADMAP.md` §9, an ADR's Follow-up Actions, or this document's "Open/unresolved" entries, stop and ask — do not pick a default and proceed.

13.4. **Reproduce reported failures and identify the exact root cause.** A reported defect is verified by direct reproduction (a failing test, a direct query, a real error message matched character-for-character against the report) before any fix is written — never patched from a guess at the likely cause.

13.5. **Fix the root cause and every real persisted path affected by it, without expanding unrelated scope.** Every code path that can reach the same root cause through real, persisted execution must be fixed in the same change; paths that cannot reach persistence (documented non-persisted demo/UI-only surfaces) are left untouched. See Section 2.5 and Pitfall table entries #4, #7.

13.6. **Require regression tests that prove the reported failure and the fix.** At minimum: one test that would have failed before the fix (reproducing the exact reported symptom), and one test that passes after it, proving the fix. Both are added in the same change, not deferred.

13.7. **Require real PostgreSQL verification for Prisma, migration, RLS, UUID, or persistence defects.** A fake/mocked Prisma client cannot catch a real schema/argument/type mismatch (see §10.2) — any defect of this class must be reproduced and re-verified against a live PostgreSQL connection, per the established pattern (§10.3).

13.8. **Require real browser verification for UI-reachable changes.** The real dev server, the real local database, and real browser automation (installed only as a temporary, fully-removed dependency where the repository does not already commit one) — never build/typecheck/lint success alone as a proxy for a UI fix actually working.

13.9. **Run full local validation before push.** Format, lint, typecheck, the full test suite, and the production build must all pass locally before any push to a remote branch.

13.10. **Verify CI is green before reporting completion.** Confirm via a reliable method (e.g. polling the GitHub check-runs API to a `completed`/`success` conclusion) — never assume, and never report success based on a single unconfirmed check.

13.11. **Never merge without explicit Owner approval.** Green CI and a clean self-report are never sufficient authorization on their own; approval from an earlier phase does not carry forward (see Section 14).

13.12. **Stop and ask when the task conflicts with an authoritative document, an ADR, a Roadmap boundary, or an unresolved decision.** This restates §1.6 as a binding rule for implementation work specifically, not only for architectural research.

---

## 14. Owner-Controlled Sprint Workflow

**Source: Owner Decision (P013A Documentation Closeout). Status: Locked.**

Every sprint follows this lifecycle:

```
Planning
  → Sprint Boundary Check
    → Owner Questions
      → Owner Decisions
        → Implementation Prompt
          → Implementation
            → Claude Internal Review
              → Owner Review
                → Git Review
                  → CI
                    → Explicit Owner Merge Approval
                      → Merge
                        → Branch Cleanup
                          → Sprint Closing Report
                            → New Chat for the next sprint
```

**Approval from an earlier phase does not automatically authorize a later phase.** Explicitly, and without exception:

- Owner approval of a _plan_ is not approval of the _implementation_ that follows it.
- Owner approval of an _implementation_ (e.g. "the fix looks correct") is not approval to _push_.
- A green _CI_ result is not Owner approval of _anything_ — it is a necessary, not sufficient, precondition for requesting merge approval.
- Owner approval of _one_ fix round is not standing approval for a _subsequent, different_ fix round in the same session — each round is reviewed and approved on its own.
- **Explicit Owner Merge Approval is a distinct phase from every phase before it**, including "the governance extraction is approved in principle" or any other approval of _research, analysis, or documentation content_. Approval of a report is not approval to merge, and approval to write documentation is not approval to merge either.

This lifecycle governs every P013A-descended sprint and every future sprint unless a future ADR or Constitution amendment explicitly supersedes it.

---

## 15. Sprint and Chat Continuity

**Source: Owner Decision (P013A Documentation Closeout). Status: Locked.**

15.1. **Each sprint should normally use a new chat.** A long-running chat accumulates context that is convenient in the moment but is not itself a durable project record.

15.2. **Before moving to the next chat, create a complete Sprint Closing Report** — root cause(s) addressed, files changed, tests added, verification performed, CI result, git/PR state, and any items deliberately left open.

15.3. **The next sprint must start from:**

- the latest authoritative project documents (Section 1's hierarchy);
- `docs/NERA_ARCHITECTURAL_INVARIANTS.md`;
- the previous Sprint Closing Report;
- the current Git/PR/CI state (re-verified directly, not recalled).

15.4. **Chat history is not an authoritative project record.** A decision, fact, or verified pitfall that exists only in a chat transcript does not exist for the project's purposes.

15.5. **Important decisions must be written into repository documentation, ADRs, Roadmap entries, or the Sprint Closing Report** — not left implicit in how an agent happened to behave during a session.

15.6. **Do not rely on ChatGPT or Claude memory as the sole source of project truth.** Any tool-specific persistent memory is a convenience cache, never a substitute for the documents listed in Section 1 and this section.

---

## 16. Knowledge Capture Policy

**Source: Owner Decision (P013A Documentation Closeout). Status: Locked.**

16.1. **Every sprint must leave the repository documentation at least as accurate as it was before the sprint.** A sprint that changes behavior without correcting the documentation that described the old behavior has made the documentation worse, not merely left it unchanged.

16.2. **A newly discovered architectural invariant, verified pitfall, regression guard, workflow rule, or environment requirement must be recorded in an appropriate authoritative document before sprint closure** — this document, `ENGINE_MAP.md`, `ROADMAP.md`, a package README, or a new ADR, whichever is the correct home per Section 1's hierarchy.

16.3. **Do not leave verified project knowledge only inside chat messages or review reports.** A fact worth acting on again in a future sprint is worth writing down where a future sprint will actually look.

16.4. **Outdated documentation discovered during a sprint must either be corrected within the approved documentation scope or explicitly recorded as an unresolved closeout blocker** — never silently left stale with no record that it was noticed.

16.5. **Do not silently reinterpret or reconcile conflicting documents.** Where two authoritative documents disagree, record the conflict (per Section 1.4/1.6) rather than picking one interpretation and proceeding as if no conflict existed.

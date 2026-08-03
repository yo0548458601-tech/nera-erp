# ENGINE_MAP.md

# Nera Engine Map

**Version:** 1.0
**Status:** Approved
**Milestone:** Milestone 1 — Product Blueprint

> Core Engines are reusable platform infrastructure. They never depend on a business module (`NERA_CONSTITUTION.md` Section 3). This document is the single inventory of engines — existing, partial, and planned — and the contract each one owns.
>
> "Current status" is evidence-based, from inspecting the repository as of Milestone 1, not aspirational:
>
> - **existing** — implemented and in real use.
> - **partial** — real code exists but a required piece (persistence, server enforcement, an actual writer/reader) is missing.
> - **planned** — approved and placed on `ROADMAP.md`, no implementation yet.

---

# 1. Identity / Authentication

- **Responsibility:** Establish who is making a request. Owns login, session issuance/verification, and the mapping from a raw provider identity to a Nera `user_profile`.
- **Boundaries:** Does not decide _what_ an authenticated user may do (that's Authorization). Does not know about organizations/institutions beyond carrying the identity that other engines scope by.
- **Owned data:** Session records; the link between an external auth identity and `user_profiles` (table already exists from P004: `authentication_user_id` on `UserProfile`).
- **Public contracts:** `getSession(request)`, `requireSession(request)` (used by middleware/route handlers), session cookie issuance/refresh/revocation.
- **Dependencies:** Vendor Abstraction principle applies — this engine is the _only_ code allowed to call the underlying auth provider's SDK directly (`NERA_CONSTITUTION.md` Section 3).
- **Consumers:** Every other engine and module that needs to know the current actor; Authorization Engine (actor identity is an input to every permission check); Audit Engine (actor on every record).
- **Events emitted:** `UserSignedIn`, `UserSignedOut`, `UserSessionExpired`.
- **Events consumed:** none.
- **Security requirements:** Server-verified session on every protected request; no code path reads protected data from a session that was only checked client-side. Session tokens never logged or exposed to client-side storage beyond what the provider's SSR cookie pattern requires.
- **Audit requirements:** Sign-in and sign-out are audited events; failed authentication attempts should be observable (rate-limiting/anomaly concerns are a P025 hardening item, not Milestone 2 scope).
- **Extension/plugin points:** None planned for V1 — a future SSO/identity-provider plugin point is a natural extension but is not designed in Milestone 1.
- **Current status:** **planned**. `apps/web/src/lib/auth/demoAuth.ts` is an explicit demo stub (`isDemoModeEnabled`), not this engine.

---

# 2. Authorization

- **Responsibility:** Decide whether an authenticated actor may perform a given action. **Delivered in P011 (see `docs/ROADMAP.md`):** a real, Prisma-backed `checkPermission()` resolving the `MembershipRole → RolePermission → allow/deny` chain, scoped to a caller-supplied Organization boundary. This implements the **Organization/Role slice** of ADR-008's full hierarchy (`Organization → Branch → Department → Role → User`) only — it is not a complete implementation of ADR-008's model. See the scope-naming reconciliation and limitations below.
- **Scope-naming reconciliation (P011, documented per ADR-002 — not a new architectural decision, no new ADR):** the already-implemented scope enum (`PermissionScope` in `packages/engines/authorization`, used only by the pure, non-authoritative `resolveEffectivePermission()`) has a `'institution'` scope level, written before ADR-002 formalized the Organization/Institution hierarchy. **That value currently means Organization**, not a real ADR-002 Institution — Organization is the only implemented tenant/security boundary today, and no `institutions` table exists. This reconciliation is deliberately narrow: it does **not** resolve the future relationship between Organization, Institution, Branch and Department — ADR-008's own follow-up leaves that open for a future ADR once those hierarchy levels have real schema (none do today).
- **Boundaries:** Never makes an identity decision (relies on Identity/Authentication). Never trusts a client-supplied decision or a caller-supplied role id — every role is resolved server-side from `MembershipRole`, and RLS is never relied on for `checkPermission()`'s own correctness (every query carries its own explicit `organizationId` filter).
- **Owned data:** `roles`, `permissions`, `role_permissions`, `membership_roles` (all exist from P004, unchanged by P011 — no schema/migration work was done); the permission catalog (`PermissionId` registry, `packages/engines/authorization`), now also mirrored into the `permissions` table by `packages/database/src/seed.ts`.
- **Public contracts:** **`checkPermission(input: { organizationId, actor: { userProfileId, membershipId }, permission }) → { permission, decision: allow | deny, reason }`** — real and Prisma-backed as of P011 (`packages/engines/authorization/src/checkPermission.ts`). Deny always wins when multiple assigned roles conflict on the same permission; default deny when no rule matches. The pre-existing pure `resolveEffectivePermission()` remains, unchanged, as a client-side, **non-authoritative UI hint only** — the two are separate functions, not wired together.
- **Dependencies:** Identity/Authentication (actor — **still not real**, see status note below), Organization / Institution (scope context).
- **Consumers:** **None yet, by design.** P011 delivered the real engine with zero real callers wired into `apps/web`, mirroring the P010 (Audit/Event Bus) precedent — `apps/web` has no server/API layer at all yet, and there is no real Identity/Authentication to supply a genuine actor. Wiring a real caller is future work, once both exist **and** a currently-open monorepo packaging prerequisite is resolved — see `docs/ROADMAP.md` Section 9.4 (the current raw-source + `NodeNext` package convention does not resolve under `apps/web`'s bundler once a package barrel statically reaches `@nera/database`; `checkPermission` is deliberately not re-exported from this package's barrel yet for this reason).
- **Events emitted:** `PermissionRuleChanged` — **not emitted by P011.** There is no rule-mutation API in this sprint (`checkPermission` is read-only); this event applies once a rule-management API exists.
- **Events consumed:** none required for V1.
- **Security requirements:** Default deny; deny-wins on role conflict. Enforced at the application layer via explicit `organizationId` filtering on every query — **not** via RLS. RLS is already enabled with policies on these tables since the P004 migration, but nothing yet sets the `app.current_organization_id` session variable those policies depend on; wiring that session context is Organization / Institution Engine (P012) work, not delivered by Authorization/P011.
- **Audit requirements:** Every permission rule change is audited (ADR-008) — **not applicable yet**: P011 has no rule-mutation API to audit. `@nera/authorization-engine` takes no dependency on `@nera/audit-engine` or `@nera/event-bus-engine` in this sprint.
- **Extension/plugin points:** Modules register new `PermissionId`s into the shared catalog rather than inventing ad-hoc flags (already the documented intent of `permissions.ts`).
- **Current status:** **partial**. `checkPermission()` is real, tested (fakes/mocks, no live Postgres — same convention as P010), and resolves the actually-persisted Organization/Role model correctly, including deny-wins conflict resolution and safe-deny for unknown/mismatched actors, memberships, organizations, and permissions. Still missing, and still `partial` rather than `existing`: any real caller (blocked on real Identity/Authentication and an `apps/web` API layer, neither of which exists), user-level overrides/explicit denials (ADR-008 names these; no table exists — deferred, no schema change made in P011), and RLS session-context wiring (P012).

---

# 3. Organization / Institution (Tenant Engine)

- **Responsibility:** Define the tenant boundary every other engine and module scopes data by, and guarantee that boundary is enforced at the database level, not only in application code. **Organization is the tenant and the security boundary.** Institution is an optional business hierarchy _below_ an Organization (an Organization may contain zero or more Institutions) — never an alternative or replacement tenant boundary. See ADR-002 for the full decision.
- **Boundaries:** Owns _what_ the tenant boundary is and _that_ it is enforced; does not own business data itself. Owns the Organization→Institution hierarchy as optional business structure; does not require any Organization to use it.
- **Owned data:** `Organization`, `OrganizationUnit`, `OrganizationMembership` (all exist from P004, scoped by `organization_id`); `institutions` (P012 — `id`, `organization_id`, `name`, `created_at`, `updated_at`, `deleted_at`; no status/lifecycle enum, since neither ADR-002 nor the P012 scope names one and soft delete alone already satisfies `NERA_CONSTITUTION.md` Section 7.4's default); RLS policy definitions keyed on `organization_id`, now `FORCE`-d (P012) on every tenant-scoped table including `institutions` itself.
- **Public contracts:** **`getOrganizationContext(context, work)`** — real, delivered in P012 (`packages/engines/organization/src/organizationContext.ts`). This is the P012 infrastructure form of the contract this document previously named `getOrganizationContext(request)`: there is still no real request/session mechanism (Identity/Authentication remains unbuilt), so `context` is the narrowest honest shape available today — `{ organizationId: string }` — rather than a literal request object. It opens one Prisma interactive transaction, sets `app.current_organization_id` for that transaction (parameterized), runs `work` against it, and returns/rolls back normally; it contains no role-switching or other test-only behavior (see Security requirements below). A future Identity/Authentication sprint derives this same `{ organizationId }` shape from a verified request and calls this same function — no signature change anticipated. **`assertInstitutionBelongsToOrganization(institutionId, organizationId)`** — also real, delivered in P012 (`packages/engines/organization/src/institutionOwnership.ts`), implementing ADR-002 Decision item 5. Every failure is a distinct `InstitutionOwnershipError` reason (`unknown-institution`, `organization-mismatch`, `institution-deleted`) rather than a bare error.
- **Dependencies:** Identity/Authentication (a session resolves to the organization(s), and optionally institution(s) within them, the user belongs to).
- **Consumers:** **None yet, by design.** P012 delivered the real engine with zero real callers wired into `apps/web`, mirroring the P010/P011 precedent — `apps/web` has no server/API layer at all yet, and there is no real Identity/Authentication to supply a genuine actor.
- **Events emitted:** `OrganizationCreated`, `OrganizationUpdated`, `OrganizationMembershipChanged`, and, once implemented, `InstitutionCreated` / `InstitutionUpdated`.
- **Events consumed:** none.
- **Security requirements:** Every tenant-scoped table has both an application-level filter and a database-level RLS policy, both keyed on `organization_id` — neither alone is sufficient, per `ARCHITECTURE.md` Section 8 and `NERA_CONSTITUTION.md` Section 6.3. As of P012, every such policy is also `FORCE`-d, so the table owner is bound by it too (previously, RLS was enabled but not forced since the P004 migration, leaving it dormant for the only role that has ever connected). A PostgreSQL superuser/`BYPASSRLS` role still bypasses RLS regardless of `FORCE` — this is a documented Postgres limitation, not a gap in this engine's policies; P012's behavioral tests prove isolation against a dedicated, repository-controlled, `NOLOGIN`/`NOSUPERUSER`/`NOBYPASSRLS` restricted role (assumed only via `SET LOCAL ROLE`, transaction-scoped, from test infrastructure — never from `getOrganizationContext()` itself, which knows nothing about it) and separately document, deliberately, that the unwrapped table-owner connection is not protected. `institution_id` is additive scoping only, and is never itself a security boundary — every access path using it also validates organization ownership via `assertInstitutionBelongsToOrganization`. No `institution_id` column has been added to any existing P004 table — none currently needs institution-level scoping.
- **Audit requirements:** Organization creation, membership changes, any cross-organization administrative action, and (once implemented) institution creation/changes are all audited.
- **Extension/plugin points:** None for V1.
- **Current status:** **partial**. `getOrganizationContext()` and `assertInstitutionBelongsToOrganization()` are real, Prisma-backed, and validated — including behaviorally, against a live PostgreSQL instance in CI (migrations applied, restricted role bootstrapped, cross-organization isolation and RLS-forcing proven by test, not just by code review). Still `partial`, not `existing`: no real caller exists yet (blocked on real Identity/Authentication and an `apps/web` API layer, neither of which exists), and this work is implemented and validated on a feature branch (`p012-organization-institution-engine`, PR #1), **not yet merged to `main`** — pending owner approval.

---

# 4. Entity

- **Responsibility:** The shared identity record for a person or organization, reused by every business module instead of each module inventing its own person/org table. A Supplier, an Employee, a Student are all an Entity plus a module-specific role/profile.
- **Boundaries:** Owns identity, profile and contact data; does not own module-specific business data (a supplier's payment terms live in the Suppliers module, not here).
- **Owned data — real, persisted PostgreSQL tables as of P013A/P013B** (`entities`, `person_profiles`, `phones`, `emails`, `addresses`, `notes`, `role_assignments`, `duplicate_override_records`, `role_definitions` — see `packages/database/prisma/schema.prisma`, migrations `20260721090000_add_entity_persistence` and `20260728204824_add_configuration_persistence`): `Entity`, `PersonProfile`, `Phone`, `Email`, `Address`, `Note`, `DuplicateOverrideRecord`, and `RoleAssignment` (entity-role-registry assignments, e.g. "תלמיד"/"הורה" — a different concept from `MembershipRole`/`Role`, Authorization's organization-role model) are all really persisted and used, not in-memory placeholders. `ListViewColumnPreference` also really persists (implemented in this package — see `packages/engines/entities/src/persistence/listViewPreferenceRepository.ts` — conceptually a Configuration/Metadata concern; see Section 15's cross-reference). **`RoleDefinition` is real and persisted as of P013B** (`packages/engines/entities/src/persistence/roleDefinitionRepository.ts`) — the 12 built-in roles are seeded per organization (`packages/database/src/seed.ts`), and administrators can create/patch/enable/disable custom roles through `apps/web/src/lib/actions/roleDefinitionActions.ts`. Kept inside this engine's own persistence structure rather than `@nera/customization-engine` (Owner decision, P013B), even though its settings surface sits alongside Custom Fields/Field Requirements. No `institution_id` column exists on `role_definitions` (Owner decision, P013B) — every organization gets its own copy of the 12 built-in roles (NOT NULL `organization_id`) rather than a nullable "global" row, so this table's RLS policy stays uniform with every other organization-scoped table. **Not yet built:** `organization_profiles` (organization-type entities are not created in this sprint — `entityType` already allows the value so a future sprint needs no column/type migration), a generic `contact_methods` table (phones/emails/addresses are three separate tables, not one polymorphic table), and `module_profiles` (no business module exists yet to attach one).
- **Tenant scoping:** every one of the tables above carries `organization_id` only — **none carries `institution_id`**. Contacts are Organization-wide today, not Institution-scoped. **No entity-to-institution ownership/assignment model has been approved or implemented** — this is a real, open architectural gap, not an oversight; see `ROADMAP.md` §9 and `NERA_ARCHITECTURAL_INVARIANTS.md` §9.1–9.2. Institution itself is real and persisted (P012, `institutions` table) but has no repository, Server Action, or management UI of its own yet — Institution rows exist today only through administrative-client test fixtures.
- **Public contracts:** CRUD for entities and profiles; `findDuplicates(candidate)`; `mergeEntities(sourceId, targetId)`; role/module-profile attachment (`assignRole`, `attachModuleProfile`) — matching the already-designed shapes in `entity.ts`, `duplicates.ts`, `merge.ts`, `moduleProfile.ts`, `roles.ts`. As of P013A, real Server Action callers exist in `apps/web/src/lib/actions/` (`entityActions.ts`, `listViewPreferenceActions.ts`) implementing person create/update/archive/restore, contact-method add/update/remove, note add, role assignment, list-view-preference get/set/reset — no Route Handlers were introduced; **reads are plain async server functions called from Server Components**, and **mutations are Server Actions** (`'use server'`).
- **Dependencies:** Authorization, Audit, Business Event Bus, Organization / Institution (every entity is tenant-scoped). All four are real callers in the P013A mutation flow, not aspirational: every mutation runs `checkPermission()` (server-enforced, inside `getOrganizationContext`'s RLS-scoped transaction), writes to the real `audit_logs` table via `recordAudit()`, and publishes an approved event (`EntityCreated`/`EntityUpdated`/`EntityArchived`) after commit.
- **Consumers:** Suppliers, and every future Entity-based module (Employees, Students, Avreichim); Contacts UI (now backed by real, persisted data, not `EntityContext`'s pre-P013A in-memory state); Search.
- **Events emitted:** `EntityCreated`, `EntityUpdated`, `EntityArchived`, `EntityRoleAssigned`, `EntitiesMerged`, `RoleDefinitionChanged` — the first four are real (`EntityRoleAssigned` published by `assignRoleAction`, the others by their respective actions in `entityActions.ts`, after transaction commit); `RoleDefinitionChanged` is real as of P013B, published by `roleDefinitionActions.ts` on create/update/status-change, after commit. `EntitiesMerged` remains not yet emitted (no merge UI/action exists yet).
- **Events consumed:** none required for V1.
- **Security requirements:** `entities.view_sensitive`, `entities.edit`, `entities.merge`, `contact_methods.edit`/`.deactivate`/`.remove`/`.restore`, `list_views.manage_defaults` and related permissions (already defined in the permission catalog) enforced server-side via real `checkPermission()` calls; sensitive fields (e.g. full ID numbers, birth dates) gated per the existing permission registry.
- **Audit requirements:** Every create/update/merge/archive is audited via the real `@nera/audit-engine`; the existing `history.ts` design (per-entity change history) remains a future, Audit-Engine-backed read model — no read/query API exists yet (Audit Engine, Section 5, has none either).
- **Extension/plugin points:** `module_profiles` and `entity_roles` are themselves the extension point — a module "extends" Entity by registering a profile shape and role, never by copying the person/org model.
- **Current status:** **partial → real persistence, no merged business-module consumer yet.** Real, tenant-isolated (RLS-`FORCE`d), authorized, audited, event-emitting persistence exists for the person side of this engine (Entity/PersonProfile/Phone/Email/Address/Note/RoleAssignment/DuplicateOverrideRecord/ListViewColumnPreference/RoleDefinition), verified by live-PostgreSQL tests and repeated real-browser verification (create → reload → edit → reload → remove → reload, data survives every reload and a fresh session). P013A (`entities`/`person_profiles`/`phones`/`emails`/`addresses`/`notes`/`role_assignments`/`duplicate_override_records`/`list_view_column_preferences`) is merged to `main` (PR #2). `role_definitions` (P013B) is merged to `main` (`p013b-configuration-persistence`, PR #3, merge commit `5720167ab1e9fb22fb865d8bce557df339b78d41`) — see `ROADMAP.md`'s P013B row. Organization-type entities, `module_profiles`, a generic `contact_methods` table, entity-to-institution assignment, and any real business-module consumer (Suppliers, P016+) remain unbuilt.

---

# 5. Audit

- **Responsibility:** Record every meaningful business action in an append-only, tamper-resistant trail, and expose it for review.
- **Boundaries:** A single shared writer for the entire platform — no engine or module maintains its own parallel audit mechanism (`NERA_CONSTITUTION.md` Section 7.6).
- **Owned data:** `audit_logs` (exists from P004: actor, `organization_id`, action, entity type/id, old/new values, metadata, timestamp — schema already matches `ARCHITECTURE.md` Section 17's required fields). Schema unchanged by P010.
- **Public contracts:** `recordAudit(input)` — implemented in `@nera/audit-engine` (P010), matching this shape (organization-scoped, nullable actor, action/entityType/entityId, old/new values, metadata). **No read/query API is implemented yet.** A permission-aware read (e.g. for the `/audit-log` nav placeholder) cannot be honestly built before P011 (Authorization Engine — Server Enforcement) exists to provide a real, resolvable authorization decision; building one now would either expose every organization's audit trail unchecked, or fake an enforcement check this engine has no authority to perform. Deferred to P011 or later.
- **Dependencies:** Identity/Authentication (actor), Organization / Institution (scope).
- **Consumers:** none yet. `@nera/audit-engine` has zero real callers in P010 — no code path in `apps/web` or any other engine calls `recordAudit()` yet, since no real server-side mutation exists until P011 onward. Intended future consumers: every engine and module performing a mutation; the future AI Assistance Engine (every AI action must be audited, per ADR-008).
- **Events emitted:** `AuditRecorded` — documented, not implemented. `@nera/audit-engine` itself has no dependency on `@nera/event-bus-engine` and does not publish this event (see Events consumed, below, for why); it would need to be published by a future caller, if a real need for it emerges.
- **Events consumed:** none. P010 resolved this entry's previously-open implementation question: `business-event-bus` depends on `audit` (see `packages/core/src/engine.ts`), not the reverse, so Audit does **not** subscribe to bus events (that direction would create a dependency cycle). Mutation sites are expected to call `recordAudit()` explicitly at the point of mutation, in parallel with (not through) any event they also publish.
- **Security requirements:** Audit records are never editable or deletable through normal application behavior — enforced today only at the application layer (`@nera/audit-engine`'s public contract exposes no update/delete function). **No database-level immutability enforcement** (trigger/`REVOKE`) exists yet; that remains a documented gap, not a claimed guarantee.
- **Audit requirements:** N/A — this engine _is_ the audit requirement for every other engine.
- **Extension/plugin points:** None — audit is deliberately not extensible/bypassable by design (`NERA_CONSTITUTION.md` Section 12).
- **Current status:** **partial**. P010 (`packages/engines/audit`, `@nera/audit-engine`) delivered a real, Prisma-backed `recordAudit()` write implementation against the live `audit_logs` table via `@nera/database` — this is real production code, not a stub. **Automated tests verify this behavior against a fake/mocked database client, not a live Postgres connection** (owner decision, P010): live-database integration testing is deferred to a later persistence/RLS sprint that already requires database-backed CI (candidate: P012). Status remains **partial**, not **existing**, because nothing calls `recordAudit()` yet and no read path exists.

---

# 6. Document

- **Responsibility:** Durable file storage and basic document generation (e.g. a payment or invoice PDF), used by any module that needs to attach or produce a file.
- **Boundaries:** Stores and serves files; does not interpret their content (that is Integration/AI Assistance, future scope). Remains ignorant of business concepts such as "Invoice" or "Purchase Order" (`ADR-013`).
- **Owned data:** File metadata (uploader, content type, storage key, size, checksum); a generic, module-agnostic many-to-many link between a Document and any number of target business records (`ADR-013` Decision D — never a single business-module-specific foreign key on the Document itself); the files themselves live in the underlying storage provider, accessed only through this engine (Vendor Abstraction principle).
- **Public contracts:** real as of P014, implemented in `@nera/document-engine` (`packages/engines/documents`). `uploadDocument(input, storageProvider)` — server-proxied upload; validates file type/size/signature before persistence (`ADR-013` Decision A/B), computes the authoritative SHA-256, generates the `organization_id`-namespaced key, and follows the `uploading → available/failed` lifecycle exactly per `ADR-011` Decision item 4/5, including the inline compensating delete on failure. `getDocumentUrl(documentId, organizationId, storageProvider, expiresInSeconds?)` — organization-ownership-checked, `available`-status-checked, time-limited (15-minute default, `ADR-013` Decision E); permission verification (`checkPermission`) happens at the Server Action layer before this is called, matching the established `requirePermission` precedent (P011/P013A/P013B), not embedded in the Core Engine function itself. `hardDeleteDocument(documentId, organizationId, purgedByUserId, storageProvider)` — the administrator hard-delete path (`ADR-013` Decision item C.4), a separate function from normal deletion. `generatePdf(template, data)` (`template` is a trusted, typed, server-only `PdfTemplate<TData>` code reference — never user-suppliable content, `ADR-012` Decision item 7), plus the generic `PaginatedTable` header-repeat helper (`ADR-012` Decision item 4).
- **Dependencies:** Organization / Institution (`@nera/organization-engine`, a real code dependency of `@nera/document-engine`). Authorization and Audit are **not** code dependencies of the engine package itself — `checkPermission`/`recordAudit` are composed at the Server Action layer (`apps/web/src/lib/actions/documentActions.ts`), matching the established P011/P013A/P013B convention (verified: `packages/engines/entities/package.json` takes the same approach).
- **Consumers:** none yet by way of a real business module — Invoices/Purchase Orders/Payments (its real future consumers) don't exist yet. Unlike the P010–P012 precedent, P014 does ship one real `apps/web` UI page (`app/(app)/operations/documents`, a `DocumentsVerificationPanel` client component) — an explicit verification surface, not a business feature, built so every mandatory flow (upload/reject/persist/signed-URL/soft-delete/restore/hard-delete) could be exercised through the same real request path a future module's UI will use, and so the generated-PDF/font work could be visually confirmed rather than only asserted by automated text extraction.
- **Events emitted:** `DocumentUploaded`, `DocumentDeleted` — real, published by `documentActions.ts` after the relevant transaction commits.
- **Events consumed:** none required for V1.
- **Security requirements:** A document uploaded under one tenant is never retrievable by a request from another tenant — `documents`/`document_links` are `organization_id NOT NULL`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, with an `*_organization_isolation` policy, migration applied and live-verified (cross-org denial proven directly against real Postgres, see Current status); access URLs are short-lived/signed (15-minute default), never permanent public links; tenant isolation for the physical object is defense-in-depth (server-generated key namespaced by `organization_id`, full authorization gate before every signed URL — verified live against a real SeaweedFS instance, see Current status) since object storage has no RLS-equivalent of its own (`ADR-011` Decision item 7). Production bucket-level controls (private bucket, least-privilege credential, SSE-KMS) remain P025 provisioning, not P014 code.
- **Audit requirements:** Upload and delete are audited via `recordAudit()` in `documentActions.ts`; an administrator hard-delete is a separate, distinctly-audited action from a normal (recoverable) delete (`ADR-013` Decision C). View/download audit (`documents.download` permission-gated) is enforced but not yet separately audited as a read event — matching the existing precedent that reads are not audited elsewhere in the repository either.
- **Extension/plugin points:** "Document handlers" — module- or plugin-registered logic for what happens after a document of a given type is uploaded (named explicitly in `NERA_CONSTITUTION.md` Section 10's extension point list); not implemented in V1, only reserved.
- **V1 product policy (`ADR-013`, Accepted):** allowed file types are PDF/JPG/JPEG/PNG/DOCX/XLSX only (no executables, scripts, HTML, SVG, or macro-enabled Office formats) — real, tested in `fileValidation.ts` (extension + declared content-type + magic-byte signature); maximum upload size 25 MB, server-enforced; deletion is soft-delete (`deletedAt`) with a 30-day recovery window (`retentionPurgeService.ts`, tested), then eligible for purge, with a separate, explicitly-confirmed, fully-audited administrator hard-delete path (`hardDeleteDocument`) for an earlier permanent purge; default signed-download URL expiration is 15 minutes. The reconciliation grace period (stuck `uploading`/`failed` rows) is **1 hour** (Owner decision, P014 planning — ADR-011 left this value open).
- **Storage and rendering provider decisions:** storage is a single generic `S3StorageProvider` adapter (`s3StorageProvider.ts`, against `@aws-sdk/client-s3`) — AWS S3 (`il-central-1`) in production (configuration only, not provisioned — P025), SeaweedFS for local/CI (`ADR-011`, Accepted) — **verified live**, not just against a fake: a full upload → signed-URL GET → delete → 404-after-delete round trip, `Content-Disposition` fidelity, idempotent delete-of-absent-key, and signed-URL expiration all pass against a real, pinned (version 4.40, commit `875cd1f67ea25e8965a4f5ba1e6aaf501ba6b6fa`) local SeaweedFS instance — see `packages/engines/documents/README.md`. PDF rendering is React PDF (`ADR-012`, Accepted) — real, with a working, tested paginated-table header-repeat proof (a 60-row/2-page fixture's header text verified present on every page via `pdf.js`'s `getTextContent()`, plus a checked-in PDF visual fixture). **Font pinning (`ADR-012` Decision item 8) is resolved** — see `packages/engines/documents/src/pdf/fonts.ts`'s doc comment: the committed Noto Sans Hebrew font is a genuine prebuilt static Regular build sourced directly from the authoritative upstream's own immutable GitHub Release (`notofonts/hebrew`, tag `NotoSansHebrew-v3.001` — not the Google Fonts mirror's moving variable-font binary the original ADR-012 spike used), independently verified by SHA-256 and by `fontkit` metadata (`postscriptName: NotoSansHebrew-Regular`, not a variable font). `hebrewFontRendering.test.ts` verifies the generated PDF's embedded `BaseFont` is `NotoSansHebrew-Regular`, never `...-Thin`, plus Hebrew text extraction, an invoice-identifier extraction case, and the known mixed Hebrew+digit+parenthesis limitation (`ADR-012` Decision item 5, still a documented template-authoring risk, not a defect).
- **Current status:** **partial** — implemented and tested on branch `p014-document-engine`, **not yet merged to `main`**, pending Owner review. The `20260803080447_add_document_persistence` migration (`documents`/`document_links` tables, RLS `ENABLE`+`FORCE`, per-table isolation policy, the hand-added `document_links_document_target_active_unique` partial unique index enforcing "one active link per document/target") is applied against the real local database and verified: `documentPersistenceRls.test.ts` is green (introspection + live cross-organization isolation, matching the `entityPersistenceRls.test.ts`/`configurationPersistenceRls.test.ts` pattern). The full repository suite is green (396/396 tests, 46/46 files, including this file, the live `s3StorageProvider.test.ts` SeaweedFS suite, and six pre-existing P011–P013B live-RLS test files corrected for the same FORCE-RLS/non-superuser-admin architecture this sprint established — see `packages/database/README.md`). `npm run lint`/`typecheck`/`build` are green (14/14 each). End-to-end functional verification (upload of every allowed type, rejection of every disallowed case, persistence, a real signed-URL round trip against SeaweedFS, a real generated Hebrew PDF visually confirmed correct with its page-2 header repeat, soft-delete/restore, admin hard-delete, cross-org denial) passed by calling the exact Server Action functions the verification UI invokes. Status becomes **existing** only once the branch is merged.

---

# 7. Workflow

- **Responsibility:** Generic, reusable approval/step logic. Business modules expose "workflow-capable actions"; they never implement their own approval logic (`ARCHITECTURE.md` Section 11).
- **Boundaries:** Owns steps, approvals, rejections, status transitions, and history of a workflow instance; does not own the business record being approved (it references it).
- **Owned data:** `workflow_definitions`, `workflow_instances`, `workflow_steps`.
- **Public contracts:** `startWorkflow(definitionId, targetRecord)`, `approveStep(instanceId, actor)`, `rejectStep(instanceId, actor, reason)`, `getPendingApprovals(actor)` (the in-app surfacing V1 uses instead of a Notification Engine).
- **Dependencies:** Authorization (who may approve), Audit, Business Event Bus.
- **Consumers:** Purchase Orders, Payment Approval (V1); any future module needing an approval step.
- **Events emitted:** `WorkflowStarted`, `WorkflowStepApproved`, `WorkflowStepRejected`, `WorkflowCompleted`.
- **Events consumed:** business events that should trigger a workflow (e.g. an Invoice reaching a status that requires Payment Approval).
- **Security requirements:** Only an actor with the specific approval permission for that step (including record-level rules, e.g. amount thresholds per ADR-008's example) can approve or reject.
- **Audit requirements:** Every state transition audited with actor, timestamp, and reason (for rejections).
- **Extension/plugin points:** "Workflows" is an explicit extension point in `NERA_CONSTITUTION.md` Section 10 — a module defines a workflow definition; it does not reimplement the engine.
- **Current status:** **planned**. V1 scope is intentionally minimal: sequential steps only, no escalation/SLA — that belongs to the deferred Automation Engine.

---

# 8. Search

- **Responsibility:** Cross-entity, cross-module search that always respects the same authorization the underlying data would require if read directly.
- **Boundaries:** Indexes and queries; does not own the source-of-truth data.
- **Owned data:** A search index (PostgreSQL full-text search for V1; a dedicated index is a future upgrade — see `ROADMAP.md` Section 7).
- **Public contracts:** `search(query, actor, filters) → results` — filtered by the same permission checks each result's underlying record would require.
- **Dependencies:** Entity, Authorization, and any module contributing searchable data (Suppliers, Invoices, etc.).
- **Consumers:** Global Search UI (nav item already reserved).
- **Events emitted:** none.
- **Events consumed:** `EntityCreated/Updated`, and equivalent module events, to keep the index current.
- **Security requirements:** A search result the user is not authorized to view must never appear, including in ranking/autocomplete hints.
- **Audit requirements:** Not required for read-only search itself; search of sensitive fields may be subject to the same `view_sensitive`-style gating as direct reads.
- **Extension/plugin points:** "Search" is an explicit extension point in `NERA_CONSTITUTION.md` Section 10 — a module registers what it wants indexed and how results should render.
- **Current status:** **planned**.

---

# 9. Reporting

- **Responsibility:** Produce correct, tenant-scoped, permission-filtered reports over real business data.
- **Boundaries:** V1 is a small set of concrete reports, not a generic report-builder engine (see `NERA_CONSTITUTION.md` Section 12 on overengineering ahead of need).
- **Owned data:** Report definitions/configuration (V1: likely code-defined, not yet user-authorable).
- **Public contracts:** `runReport(reportId, params, actor) → rows`.
- **Dependencies:** Authorization, Organization / Institution, and whichever modules a given report reads from (Suppliers, Finance in V1).
- **Consumers:** Dashboard, the `/reports` nav surface.
- **Events emitted:** none.
- **Events consumed:** none required for V1 (reports query current state rather than replaying events).
- **Security requirements:** Same permission model as any other read path — a report never surfaces data its viewer could not see directly.
- **Audit requirements:** Export of a report (per the existing `entities.export` permission pattern) is audited.
- **Extension/plugin points:** "Reports" is an explicit extension point in `NERA_CONSTITUTION.md` Section 10 — a module contributes report definitions; a generic report/dashboard builder is future scope.
- **Current status:** **planned**. `apps/web`'s current Dashboard is static demo content, not this engine.

---

# 10. Forms

- **Responsibility:** Structured data collection beyond a module's built-in record types, built on the existing Customization capability rather than a new field system.
- **Boundaries:** Reuses `custom_field_definitions`/`custom_field_values` (Configuration/Metadata engine) rather than inventing a parallel field model.
- **Owned data:** Form definitions (a named, ordered set of custom fields) and submissions.
- **Public contracts:** `submitForm(formId, values, actor)`, `getFormDefinition(formId)`.
- **Dependencies:** Configuration/Metadata, Document (attachments), Workflow (if a form requires approval), Authorization, Audit.
- **Consumers:** The `/operations/forms` nav surface.
- **Events emitted:** `FormSubmitted`.
- **Events consumed:** none required for V1.
- **Security requirements:** Same permission model as any module; a submitted form is tenant-scoped like any other record.
- **Audit requirements:** Submission and any subsequent edit are audited.
- **Extension/plugin points:** "Forms" is an explicit extension point in `NERA_CONSTITUTION.md` Section 10.
- **Current status:** **planned**. Today's `/operations/forms` route is a placeholder page.

---

# 11. Notification

- **Responsibility:** Deliver a message to the right recipient, through the right channel, at the right time, based on a business event or a request from another engine/module.
- **Boundaries:** Modules never send notifications directly; they publish an event or a notification request (`ARCHITECTURE.md` Section 13).
- **Owned data:** Notification templates, delivery preferences, delivery status.
- **Public contracts:** `requestNotification(event, recipients, template)`.
- **Dependencies:** Business Event Bus, Organization / Institution, Configuration/Metadata (recipient preferences).
- **Consumers:** Workflow (post-V1, once escalation/multi-channel matters), Automation (post-V1).
- **Events emitted:** `NotificationSent`, `NotificationFailed`.
- **Events consumed:** any event a tenant has configured a notification rule for.
- **Security requirements:** A notification never includes data the recipient is not authorized to see; delivery channel credentials are never exposed to business modules (Vendor Abstraction).
- **Audit requirements:** Delivery attempts and outcomes are recorded.
- **Extension/plugin points:** Channel providers (email/SMS/push) are pluggable behind this engine.
- **Current status:** **planned, explicitly deferred beyond V1** (`PRODUCT_VISION.md` Section 5). V1's Workflow approvals are surfaced in-app only, without this engine.

---

# 12. Integration

- **Responsibility:** Connect Nera to external systems and data sources — inbound (e.g. a mailbox to watch for invoices) and outbound (e.g. a bank clearing path such as MASAV). Owns provider adapters and external-system communication generally: banking/MASAV exchange, email, messaging, document ingestion, external APIs, and (in coordination with AI Assistance) future AI provider communication. **Approved as a platform engine by ADR-005** (Vendor Abstraction and Integration Engine) — new relative to the original `ARCHITECTURE.md` Section 5 list; see the note below.
- **Boundaries:** Owns the connection and raw data exchange; does not own business interpretation of that data (that is the consuming module, or AI Assistance for extraction).
- **Owned data:** Connection configuration, credentials (vendor-abstracted), sync/exchange logs.
- **Public contracts:** Provider-specific adapters behind a common `IntegrationSource`/`IntegrationSink` contract (exact shape deferred to design work when the first integration is built).
- **Dependencies:** Document (store what comes in/out), Audit, Business Event Bus, Authorization.
- **Consumers:** MASAV (V1, outbound file exchange); the future AI Assistance invoice flow (inbound email).
- **Events emitted:** `IntegrationSyncCompleted`, `IntegrationSyncFailed`.
- **Events consumed:** varies per integration.
- **Security requirements:** Credentials for any external system are never accessible to business-module code directly (Vendor Abstraction); every external exchange is tenant-scoped.
- **Audit requirements:** Every inbound/outbound exchange with an external system is audited.
- **Extension/plugin points:** "Integrations" is an explicit extension point in `NERA_CONSTITUTION.md` Section 10.
- **Current status:** **planned**. V1 needs only the narrow MASAV file-exchange slice of this engine (see `MODULE_MAP.md`, MASAV); the general-purpose engine matures post-V1 alongside AI Assistance.
- **Follow-up (not open):** `ARCHITECTURE.md` Section 5's originally approved engine list does not yet include "Integration Engine." This is a documentation-consistency gap, not an unresolved decision — ADR-005 already approves the engine. A future documentation pass should amend `ARCHITECTURE.md` Section 5 to match.

---

# 13. AI Assistance

- **Responsibility:** Provide suggestions, explanations, confidence, and evidence to the user, across any module, without ever acting autonomously on sensitive/irreversible actions. Governed in full by `NERA_CONSTITUTION.md` Section 5.
- **Boundaries:** Never a business module; never bypasses Authorization, Organization / Institution, or Audit; acts as the requesting user, never as itself.
- **Owned data:** A generic "suggestion" record: target entity/record, suggestion type, payload, confidence, evidence references, status (`pending` / `approved` / `rejected` / `corrected`), and feedback captured on the outcome.
- **Public contracts:** `proposeSuggestion(type, target, payload, confidence, evidence)`, `recordFeedback(suggestionId, outcome)` — consumed by any module's UI to render a suggestion using one shared pattern instead of each module inventing its own.
- **Dependencies:** Authorization (acts as the user), Audit (every AI action logged), Document/Integration (future: source evidence for extraction-based suggestions), and, per `TECH_STACK.md`, a provider-agnostic AI layer — business modules never call an AI provider SDK directly (Vendor Abstraction).
- **Consumers:** Invoices (future: extracted-field suggestions), Entity (future: duplicate-match suggestions upgraded from rule-based to AI-assisted).
- **Events emitted:** `AiSuggestionProposed`, `AiSuggestionResolved`.
- **Events consumed:** domain events it may want to react to once implemented (e.g. `DocumentUploaded` for the future email-invoice flow).
- **Security requirements:** No irreversible or business-sensitive action without explicit user approval (`NERA_CONSTITUTION.md` Section 5.4); every action passes the same authorization check a human user's equivalent action would.
- **Audit requirements:** Every AI-originated action or suggestion outcome is audited, per ADR-008's explicit AI Integration section.
- **Extension/plugin points:** Suggestion types are the extension point — a module registers a new suggestion type against the shared contract rather than building its own suggestion UI/data model.
- **Current status:** **planned, implementation explicitly deferred**. The suggestion contract shape above should inform how Invoices (Milestone 3) models "confirmed vs. proposed" data, even though nothing populates the proposed side yet.

---

# 14. Plugin / Extension Runtime

- **Responsibility:** Own the mechanism by which the extension points named throughout this document (navigation, UI surfaces, permissions, entity types, workflows, search, reports, forms, business events, document handlers, integrations) are actually registered and executed, once more than one consumer of them exists.
- **Boundaries:** Defines _how_ an extension attaches; never grants an extension a capability the security principles forbid (`NERA_CONSTITUTION.md` Section 10 — a plugin can never bypass authentication, authorization, tenant boundaries, RLS, audit, or validation).
- **Owned data:** A registry of installed extensions and what they are authorized to extend.
- **Public contracts:** A registration contract per extension point (e.g. `registerNavItem`, `registerReport`, `registerWorkflowDefinition`) — each one is really owned by the engine it extends (Reporting owns the report registration contract, etc.); this engine owns the cross-cutting registry and authorization gate in front of all of them.
- **Dependencies:** Authorization (an extension's registration is itself a privileged, audited action).
- **Consumers:** every other engine, as the shared front door for registering an extension rather than each engine inventing its own registration mechanism.
- **Events emitted:** `ExtensionRegistered`, `ExtensionDisabled`.
- **Events consumed:** none required for V1.
- **Security requirements:** Registering or enabling an extension is itself an authorized, audited action; an extension cannot self-elevate its own permissions.
- **Audit requirements:** Extension install/enable/disable is audited.
- **Extension/plugin points:** This engine _is_ the extension-point mechanism — see Section 10 of `NERA_CONSTITUTION.md` for the authoritative list of what may be extended.
- **Current status:** **partial**. P008 (ADR-010) built the registration skeleton in `@nera/core` — a closed `ExtensionPointId` union matching `NERA_CONSTITUTION.md` Section 10 exactly, and a register/list/query mechanism, tested. There is still no dynamic/untrusted code execution, no sandboxing, and no marketplace — that remains future work requiring its own ADR per ADR-003. See the Appendix below.

---

# 15. Configuration / Metadata

- **Responsibility:** Let tenants adapt fields, forms, lists, statuses, and other configurable surfaces without code changes, per `ARCHITECTURE.md` Section 15. In the current repository this responsibility is split across two existing packages that this entry consolidates conceptually without renaming them yet.
- **Boundaries:** Owns configuration/metadata; never owns business data itself.
- **Owned data:**
  - **Custom fields and field requirement rules are real, persisted data as of P013B**: `custom_field_definitions`, `custom_field_values`, `field_requirement_rules` (see `packages/database/prisma/schema.prisma`, migration `20260728204824_add_configuration_persistence`) are implemented in `@nera/customization-engine` (`packages/engines/customization/src/persistence/`) with real Server Action callers in `apps/web/src/lib/actions/customFieldActions.ts` and `fieldRequirementActions.ts`. `custom_field_values.value` is a single `jsonb` column holding the existing typed `CustomFieldValueData` discriminated union (Owner decision, P013B) — no separate table/nullable-column per field type. No `institution_id` column exists on either table (Owner decision, P013B): `CustomFieldTargetScope`/`FieldRequirementScope` still carry an `'institution'` value on the pure engine types, but the settings UI never offers it as a selectable scope in this sprint, so no row is expected to carry it in practice.
  - **List-view column configuration is real, persisted data as of P013A**: the `list_view_column_preferences` table and its repository (`getEffectivePreference`/`setPreference`/`resetPreference`, `user → role → institution → system → built-in default` precedence) are implemented under `packages/engines/entities` (see Section 4), not `@nera/customization-engine`, and have real Server Action callers in `apps/web/src/lib/actions/listViewPreferenceActions.ts`. This is a documentation/ownership split worth resolving in a future pass, not a second, competing implementation.
  - From `@nera/settings-engine` (existing, minimal): tenant/organization/user-scoped settings (currently 3 defaults: calendar system, UI language, UI direction) — still in-memory; explicitly out of scope for P013B (Owner decision).
- **Public contracts:** `getCustomFieldsFor(entityType, context)`, `setCustomFieldValue(...)`, `resolveSetting(key, context)` — matching the shapes already implemented in both packages. List-view preferences instead use `getEffectivePreference`/`setPreference`/`resetPreference` (Section 4). Custom fields/field requirement rules now also have real repository functions: `createCustomFieldDefinitionRepository`, `createCustomFieldValueRepository`, `createFieldRequirementRuleRepository` (P013B).
- **Dependencies:** Organization / Institution, Authorization (`custom_fields.manage`, `custom_fields.view_sensitive`, `list_views.manage_defaults`, `field_requirements.manage_defaults` — all already defined in the permission catalog).
- **Consumers:** Entity (custom fields on people/organizations), Forms (built directly on this engine), every module needing tenant-specific settings.
- **Events emitted:** `CustomFieldDefinitionChanged`, `FieldRequirementRuleChanged`, `SettingChanged` — `CustomFieldDefinitionChanged` is real as of P013B, published by `customFieldActions.ts` on definition create/status-change, after commit; `FieldRequirementRuleChanged` is real as of P013B, published by `fieldRequirementActions.ts` on rule set, after commit. `SettingChanged` remains not yet emitted (Settings persistence is out of scope for P013B).
- **Events consumed:** none required for V1.
- **Security requirements:** Sensitive custom fields are gated by `custom_fields.view_sensitive`, enforced server-side via real `checkPermission()` calls as of P013B (previously deferred pending Authorization enforcement, which now exists — see Section 2).
- **Audit requirements:** Definition changes (adding/editing/disabling a custom field, changing a default setting) are audited; individual value changes on a record are audited as part of that record's own audit trail (via Entity/module, not duplicated here). Real as of P013B: `custom_field_definition.created`/`.status_changed`, `custom_field_value.set`, and `field_requirement_rule.set` are all recorded via `@nera/audit-engine` in the same transaction as the mutation.
- **Extension/plugin points:** A module registers its own custom-field-eligible entity/record types against this engine rather than building its own field system.
- **Current status:** **partial**. Custom fields and field requirement rules are real and persisted as of P013B (see above) — RLS-`FORCE`d, authorized, audited, event-emitting, verified by live-PostgreSQL tests and real-browser verification. This is merged to `main` (`p013b-configuration-persistence`, PR #3, merge commit `5720167ab1e9fb22fb865d8bce557df339b78d41`) — see `ROADMAP.md`'s P013B row. `@nera/settings-engine` remains a minimal, in-memory skeleton (explicitly deferred). List-view column preferences remain real and persisted as of P013A (see Section 4).

---

# 16. Business Event Bus

- **Responsibility:** Let engines and modules communicate by publishing and subscribing to events instead of calling each other directly, per `ARCHITECTURE.md` Section 10 ("Nera uses an internal Event Bus from day one").
- **Boundaries:** In-process for V1 (`NERA_CONSTITUTION.md`: "in-process domain events") — not a distributed queue. Confirmed by the P010 implementation: no external broker, no persistence, no retries, no background worker, no network dependency. A module publishes events; it does not call another module's internals.
- **Owned data:** None. No event log is persisted (the schema's own "if persisted" condition is now resolved: it is not, for V1) — nothing survives a process restart; the event type registry is just the string `eventType` values callers choose, not a centrally predefined enum.
- **Public contracts:** `subscribe(eventType, handler) → unsubscribe`; `publish(input) → Promise<PublishResult>`, where `PublishResult` reports `deliveredCount` and a structured `failures` list rather than throwing. Handlers may be synchronous or return a `Promise` (deliberate design choice, P010 — see `packages/engines/event-bus/src/eventBus.ts`); `publish()` awaits each subscriber in registration order, sequentially, for deterministic delivery order.
- **Dependencies:** Organization / Institution (every event carries tenant scope), Audit (many events are also audit-worthy, but the two are not the same mechanism — see Audit's boundary). This is an engine-level relationship recorded in `packages/core/src/engine.ts`'s registry, preserved unchanged by P010 — the `@nera/event-bus-engine` package itself declares zero npm dependencies (it is a pure in-memory implementation), consistent with the registry direction `business-event-bus → audit`, never the reverse.
- **Consumers:** none yet. `@nera/event-bus-engine` has zero real callers in P010 — nothing in `apps/web` or any other engine publishes or subscribes yet. Intended future consumers: Audit (as a direct caller, not a subscriber — see Audit's Events consumed note), Notification (post-V1), Automation (post-V1), Search (index refresh), any engine choosing reactive over direct invocation.
- **Events emitted:** N/A — this engine carries events, it does not originate business ones itself. **No `EventBusSubscriberFailed` (or equivalent) lifecycle event is published back onto the bus when a subscriber fails** — a P010 design decision: re-publishing onto the same bus from inside its own failure-handling path risks unbounded or ambiguous recursion for no real benefit, since `publish()` already returns the same failure information directly to the caller in its `PublishResult`.
- **Events consumed:** all business events published by every engine/module (`EntityCreated`, `WorkflowStarted`, `DocumentUploaded`, `InvoiceReceived`, `PaymentApproved`, `PaymentMarkedPaid`, etc. — the canonical event name list is grown incrementally by each engine/module that needs one, not centrally predefined here).
- **Security requirements:** An event payload never carries more data than its least-trusted possible subscriber should see; sensitive data is referenced (an ID to re-fetch, permission-checked) rather than embedded, wherever practical. Not yet enforced by any real call site, since there are no callers yet.
- **Audit requirements:** Not itself an audit mechanism — see Audit (Section 5) — but its own operational failures (a subscriber throwing) must be observable, not silently swallowed: `publish()`'s returned `failures` array is this engine's answer to that requirement for P010.
- **Extension/plugin points:** "Business events" is an explicit extension point in `NERA_CONSTITUTION.md` Section 10 — a plugin may subscribe to (never intercept/block) a business event.
- **Current status:** **partial**. P010 (`packages/engines/event-bus`, `@nera/event-bus-engine`) delivered a real, tested, in-process publish/subscribe implementation with subscriber-failure isolation — this is real code, not a stub. Status is **partial**, not **existing**, because nothing calls `publish()`/`subscribe()` yet; no UI or API layer was added in P010.

---

# Appendix — Platform Core Package (`@nera/core`)

Not a Core Engine — it sits **one layer below** the 16 engines enumerated above (Platform, not Core Engines, per `NERA_CONSTITUTION.md` Section 3.9's `Platform → Core Engines → Business Modules → Apps` order). Recorded here because it is now the thing this document's own status labels partly depend on (see Plugin / Extension Runtime, Section 14, above), and because engines depend on it, not the other way around.

- **Responsibility:** Owns the Engine Registry (a code-side, tested mirror of this document's 17 entries — see `engineRegistry` in `packages/core/src/engine.ts`), the `DatabaseProvider`/`AuthProvider`/`StorageProvider` contracts (ADR-009), the Plugin Runtime registration skeleton (ADR-003), and dependency-boundary validation that checks the real workspace against the Constitution's layer graph.
- **Owned data:** None at runtime — pure types, a data catalog transcribed from this document, and validation logic. No database table, no persisted state.
- **Consumers:** None yet. Introduced in P008 (ADR-010) with zero real consumers by design — ready for the next sprint that needs a provider, a registry lookup, or an extension-point registration.
- **Current status:** **existing**. `packages/core` — built in P008, fully tested (`vitest`), zero runtime dependencies.

---

# Appendix — Calendar Engine (existing, not in the required list)

Not part of the engine set enumerated above, but worth recording because it already exists and is the most mature code in the repository.

- **Responsibility:** Gregorian/Hebrew calendar conversion, formatting, and comparison, entirely through `Intl`, with no hardcoded calendar arithmetic.
- **Owned data:** none — pure functions.
- **Consumers:** any UI or module displaying or filtering by date (Contacts' Hebrew birthday filter today; Students/Avreichim's yahrzeit/anniversary logic, post-V1).
- **Current status:** **existing**. `packages/engines/calendar` — the only package in the repository with real automated test coverage.

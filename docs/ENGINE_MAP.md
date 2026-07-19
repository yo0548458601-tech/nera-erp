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

- **Responsibility:** Decide whether an authenticated actor may perform a given action, using the hierarchical resolution model from ADR-008 (`user → role → institution → system → default-deny`). Note: the already-implemented scope enum (`PermissionScope` in `packages/engines/authorization`) uses `'institution'` as one of its four scope levels, written before ADR-002 formalized the Organization/Institution hierarchy — whether that scope level means "Organization" or a real sub-Organization "Institution" in ADR-002's sense is a reconciliation P011 must make explicit, not assumed here.
- **Boundaries:** Never makes an identity decision (relies on Identity/Authentication). Never trusts a client-supplied decision — every check re-runs server-side, per `NERA_CONSTITUTION.md` Section 6.
- **Owned data:** `roles`, `permissions`, `role_permissions`, `membership_roles` (all exist from P004); the permission catalog (`PermissionId` registry, already implemented in `packages/engines/authorization`).
- **Public contracts:** `checkPermission(actor, permission, resourceContext) → { decision: allow | deny, source, ruleId }`, matching the already-implemented and documented `resolveEffectivePermission()` precedence exactly.
- **Dependencies:** Identity/Authentication (actor), Organization / Institution (scope context).
- **Consumers:** Every business module and every other engine's write/sensitive-read path; the UI (as a non-authoritative hint only).
- **Events emitted:** `PermissionRuleChanged`.
- **Events consumed:** none required for V1.
- **Security requirements:** Default deny. Enforced exclusively server-side. RLS on every tenant-scoped table as the second, independent enforcement layer (`NERA_CONSTITUTION.md` Section 6.3).
- **Audit requirements:** Every permission rule change is audited (ADR-008: "every authorization decision must be logged" — rule _changes_, not every read-time check, are the auditable unit for volume reasons; this boundary is confirmed in P011).
- **Extension/plugin points:** Modules register new `PermissionId`s into the shared catalog rather than inventing ad-hoc flags (already the documented intent of `permissions.ts`).
- **Current status:** **partial**. The resolution logic and DB schema both exist; server-side enforcement, RLS, and the `checkPermission` service do not. The engine's own source code documents this gap explicitly today.

---

# 3. Organization / Institution (Tenant Engine)

- **Responsibility:** Define the tenant boundary every other engine and module scopes data by, and guarantee that boundary is enforced at the database level, not only in application code. **Organization is the tenant and the security boundary.** Institution is an optional business hierarchy _below_ an Organization (an Organization may contain zero or more Institutions) — never an alternative or replacement tenant boundary. See ADR-002 for the full decision.
- **Boundaries:** Owns _what_ the tenant boundary is and _that_ it is enforced; does not own business data itself. Owns the Organization→Institution hierarchy as optional business structure; does not require any Organization to use it.
- **Owned data:** `Organization`, `OrganizationUnit`, `OrganizationMembership` (all exist from P004, scoped by `organization_id`); a future `institutions` table under `Organization` (not yet implemented — see ADR-002 and `ROADMAP.md`); RLS policy definitions keyed on `organization_id`.
- **Public contracts:** An organization-context accessor available to every request (`getOrganizationContext(request)`); an RLS policy template, keyed on `organization_id`, applied to every new tenant-scoped table; once implemented, an institution-ownership check (`assertInstitutionBelongsToOrganization(institutionId, organizationId)`) that every code path using `institution_id` must call — `institution_id` is never trusted alone.
- **Dependencies:** Identity/Authentication (a session resolves to the organization(s), and optionally institution(s) within them, the user belongs to).
- **Consumers:** every engine and module owning tenant-scoped data.
- **Events emitted:** `OrganizationCreated`, `OrganizationUpdated`, `OrganizationMembershipChanged`, and, once implemented, `InstitutionCreated` / `InstitutionUpdated`.
- **Events consumed:** none.
- **Security requirements:** Every tenant-scoped table has both an application-level filter and a database-level RLS policy, both keyed on `organization_id` — neither alone is sufficient, per `ARCHITECTURE.md` Section 8 and `NERA_CONSTITUTION.md` Section 6.3. `institution_id`, once it exists, is additive scoping only, and is never itself a security boundary — every access path using it also validates organization ownership.
- **Audit requirements:** Organization creation, membership changes, any cross-organization administrative action, and (once implemented) institution creation/changes are all audited.
- **Extension/plugin points:** None for V1.
- **Current status:** **partial**. `Organization` / `OrganizationUnit` / `OrganizationMembership` exist and are used by the (demo) auth/authorization UI; RLS is not implemented; the Organization/Institution hierarchy itself is now decided (ADR-002), but its schema implementation (an `institutions` table, optional `institution_id` columns, the ownership-check pattern) has not been built — see `ROADMAP.md` for scheduling.

---

# 4. Entity

- **Responsibility:** The shared identity record for a person or organization, reused by every business module instead of each module inventing its own person/org table. A Supplier, an Employee, a Student are all an Entity plus a module-specific role/profile.
- **Boundaries:** Owns identity, profile and contact data; does not own module-specific business data (a supplier's payment terms live in the Suppliers module, not here).
- **Owned data:** `entities`, `person_profiles`, `organization_profiles`, `contact_methods`, `entity_roles`, `module_profiles`, `notes` — all currently modeled as rich TypeScript types in `packages/engines/entities` with no database table yet.
- **Public contracts:** CRUD for entities and profiles; `findDuplicates(candidate)`; `mergeEntities(sourceId, targetId)`; role/module-profile attachment (`assignRole`, `attachModuleProfile`) — all matching the already-designed shapes in `entity.ts`, `duplicates.ts`, `merge.ts`, `moduleProfile.ts`, `roles.ts`.
- **Dependencies:** Authorization, Audit, Business Event Bus, Organization / Institution (every entity is tenant-scoped).
- **Consumers:** Suppliers, and every future Entity-based module (Employees, Students, Avreichim); Contacts UI; Search.
- **Events emitted:** `EntityCreated`, `EntityUpdated`, `EntityArchived`, `EntityRoleAssigned`, `EntitiesMerged`.
- **Events consumed:** none required for V1.
- **Security requirements:** `entities.view_sensitive`, `entities.edit`, `entities.merge` and related permissions (already defined in the permission catalog) enforced server-side; sensitive fields (e.g. full ID numbers, birth dates) gated per the existing permission registry.
- **Audit requirements:** Every create/update/merge/archive is audited; the existing `history.ts` design (per-entity change history) becomes a real, Audit-Engine-backed read model rather than in-memory state.
- **Extension/plugin points:** `module_profiles` and `entity_roles` are themselves the extension point — a module "extends" Entity by registering a profile shape and role, never by copying the person/org model.
- **Current status:** **partial**. The domain model is the most mature code in the repository (17 focused files); it has zero persistence, and the Contacts UI holds all state in a React context (`EntityContext`), lost on refresh.

---

# 5. Audit

- **Responsibility:** Record every meaningful business action in an append-only, tamper-resistant trail, and expose it for review.
- **Boundaries:** A single shared writer for the entire platform — no engine or module maintains its own parallel audit mechanism (`NERA_CONSTITUTION.md` Section 7.6).
- **Owned data:** `audit_logs` (exists from P004: actor, `organization_id`, action, entity type/id, old/new values, metadata, timestamp — schema already matches `ARCHITECTURE.md` Section 17's required fields).
- **Public contracts:** `recordAudit(actor, action, entityType, entityId, { before, after, metadata })`; a read/query API for an audit log viewer (the `/audit-log` nav placeholder becomes real here).
- **Dependencies:** Identity/Authentication (actor), Organization / Institution (scope).
- **Consumers:** every engine and module performing a mutation; the future AI Assistance Engine (every AI action must be audited, per ADR-008).
- **Events emitted:** `AuditRecorded`.
- **Events consumed:** domain events from every other engine, where a subscription model is simpler than an explicit call at each mutation site (implementation detail decided in P010, not fixed here).
- **Security requirements:** Audit records are never editable or deletable through normal application behavior; only a fully authorized, itself-audited administrative path may touch them.
- **Audit requirements:** N/A — this engine _is_ the audit requirement for every other engine.
- **Extension/plugin points:** None — audit is deliberately not extensible/bypassable by design (`NERA_CONSTITUTION.md` Section 12).
- **Current status:** **partial**. The table exists and is fully unused; nothing in the codebase writes to it today.

---

# 6. Document

- **Responsibility:** Durable file storage and basic document generation (e.g. a payment or invoice PDF), used by any module that needs to attach or produce a file.
- **Boundaries:** Stores and serves files; does not interpret their content (that is Integration/AI Assistance, future scope).
- **Owned data:** File metadata (owner entity/record, tenant, uploader, content type, storage key); the files themselves live in the underlying storage provider, accessed only through this engine (Vendor Abstraction principle).
- **Public contracts:** `uploadDocument(file, context) → documentId`, `getDocumentUrl(documentId, actor)` (permission-checked, time-limited), `generatePdf(template, data)`.
- **Dependencies:** Authorization (per-document access check), Audit, Organization / Institution.
- **Consumers:** Invoices, Purchase Orders, Payments (V1); Forms (attachments); future Integration Engine (source documents for AI extraction).
- **Events emitted:** `DocumentUploaded`, `DocumentDeleted`.
- **Events consumed:** none required for V1.
- **Security requirements:** A document uploaded under one tenant is never retrievable by a request from another tenant, verified the same way as any other tenant-scoped resource; access URLs are short-lived/signed, never permanent public links by default.
- **Audit requirements:** Upload, view (where sensitive), and delete are audited.
- **Extension/plugin points:** "Document handlers" — module- or plugin-registered logic for what happens after a document of a given type is uploaded (named explicitly in `NERA_CONSTITUTION.md` Section 10's extension point list); not implemented in V1, only reserved.
- **Current status:** **planned**.

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
  - From `@nera/customization-engine` (existing): `custom_field_definitions`, `custom_field_values`, list-view column configuration, field requirement rules (required/optional/hidden per entity type/role/institution — same pre-ADR-002 scope-naming caveat as Section 2 above applies here).
  - From `@nera/settings-engine` (existing, minimal): tenant/organization/user-scoped settings (currently 3 defaults: calendar system, UI language, UI direction).
- **Public contracts:** `getCustomFieldsFor(entityType, context)`, `setCustomFieldValue(...)`, `resolveSetting(key, context)` — matching the shapes already implemented in both packages.
- **Dependencies:** Organization / Institution, Authorization (`custom_fields.manage`, `custom_fields.view_sensitive`, `list_views.manage_defaults`, `field_requirements.manage_defaults` — all already defined in the permission catalog).
- **Consumers:** Entity (custom fields on people/organizations), Forms (built directly on this engine), every module needing tenant-specific settings.
- **Events emitted:** `CustomFieldDefinitionChanged`, `SettingChanged`.
- **Events consumed:** none required for V1.
- **Security requirements:** Sensitive custom fields are gated by `custom_fields.view_sensitive`, enforced server-side once Authorization enforcement (Section 2) exists.
- **Audit requirements:** Definition changes (adding/editing/disabling a custom field, changing a default setting) are audited; individual value changes on a record are audited as part of that record's own audit trail (via Entity/module, not duplicated here).
- **Extension/plugin points:** A module registers its own custom-field-eligible entity/record types against this engine rather than building its own field system.
- **Current status:** **partial**. `@nera/customization-engine` has real, fairly complete logic (five focused files) with no persistence; `@nera/settings-engine` is a minimal skeleton. Both are in-memory today.

---

# 16. Business Event Bus

- **Responsibility:** Let engines and modules communicate by publishing and subscribing to events instead of calling each other directly, per `ARCHITECTURE.md` Section 10 ("Nera uses an internal Event Bus from day one").
- **Boundaries:** In-process for V1 (`NERA_CONSTITUTION.md`: "in-process domain events") — not a distributed queue. A module publishes events; it does not call another module's internals.
- **Owned data:** An event log (for debugging/replay), if persisted; the event type registry.
- **Public contracts:** `publish(eventType, payload)`, `subscribe(eventType, handler)`.
- **Dependencies:** Organization / Institution (every event carries tenant scope), Audit (many events are also audit-worthy, but the two are not the same mechanism — see Audit's boundary).
- **Consumers:** Audit, Notification (post-V1), Automation (post-V1), Search (index refresh), any engine choosing reactive over direct invocation.
- **Events emitted:** N/A — this engine carries events, it does not originate business ones itself, beyond its own lifecycle events (`EventBusSubscriberFailed`, for observability).
- **Events consumed:** all business events published by every engine/module (`EntityCreated`, `WorkflowStarted`, `DocumentUploaded`, `InvoiceReceived`, `PaymentApproved`, `PaymentMarkedPaid`, etc. — the canonical event name list is grown incrementally by each engine/module that needs one, not centrally predefined here).
- **Security requirements:** An event payload never carries more data than its least-trusted possible subscriber should see; sensitive data is referenced (an ID to re-fetch, permission-checked) rather than embedded, wherever practical.
- **Audit requirements:** Not itself an audit mechanism — see Audit (Section 5) — but its own operational failures (a subscriber throwing) must be observable, not silently swallowed.
- **Extension/plugin points:** "Business events" is an explicit extension point in `NERA_CONSTITUTION.md` Section 10 — a plugin may subscribe to (never intercept/block) a business event.
- **Current status:** **planned**. No implementation exists; this is one of the two foundational pieces (with Audit) built in P010, before Authorization enforcement in P011.

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

# NERA_CONSTITUTION.md

# Nera Constitution

**Version:** 1.0
**Status:** Approved
**Milestone:** Milestone 1 — Product Blueprint

---

# 1. Purpose and Authority

This document is the highest-authority governance document in the Nera Platform.

It formalizes principles that were previously spread across `PROJECT_VISION.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md` and the approved ADRs, and adds principles newly approved for Milestone 1: explainability, AI philosophy, and the plugin platform.

Where this document and an older foundation document disagree, this document wins. Older documents remain valid for details not restated here. See Section 13 for the full document hierarchy.

Every contributor — human or AI — must follow this constitution. If a requested implementation conflicts with it, development must stop and the conflict must be resolved before implementation continues.

---

# 2. Product Principles

1. Nera is a general-purpose, modular ERP platform for organizations of any kind. The first customer may be a yeshiva or Torah institution, but the platform core must remain universal. Industry-specific concepts belong to business modules, never to the platform core.
2. Nera exists to reduce manual work, prevent human errors, and give users full control over their business processes.
3. Nera should feel like a highly accurate professional employee working alongside the user — not a black box, and not a replacement for the user's judgment.
4. **Golden principle: Nera never replaces professional judgment. Nera assists. The user decides.**
5. Accuracy is more important than speed. When reliability conflicts with convenience or speed, reliability wins.

---

# 3. Architecture Principles

1. **Platform First** — General capabilities belong in reusable engines before they belong in business modules. If a capability is needed by more than one module, it is platform infrastructure, not module code.
2. **No Business Logic Duplication** — Business logic must not be duplicated across modules. A rule implemented once must be reused, not re-implemented.
3. **Modular by Design** — Modules must be independently maintainable, independently testable, and independently removable. A module must never corrupt the platform core, and must never import another module's internal implementation.
4. **Configuration over Custom Code** — Prefer configuration, metadata, rules and extension points over one-off code. Hardcoded tenant-specific or institution-specific behavior is forbidden.
5. **Simplicity Wins** — When two solutions satisfy the requirements, prefer the simpler one. Do not design for hypothetical future requirements.
6. **Plugin Platform** — Nera is designed as an extensible platform from day one, even though no plugin marketplace exists yet. See Section 10.
7. **Vendor Abstraction** — Nera depends on specific infrastructure vendors (for example, an auth/storage/database provider, or a banking/MASAV, email, or messaging integration) only through a Core Engine boundary — the Integration Engine for external-system communication generally, or the specific owning engine (Identity/Authentication, Document, AI Assistance) where one exists. Business modules and UI code never call a vendor SDK directly; they call the engine that wraps it. This preserves the platform's ability to change vendors without rewriting business logic. This principle does not itself select any vendor — see ADR-005 and `ROADMAP.md` Section 9 for what remains unresolved.
8. **Backward Compatibility** — Public APIs and data contracts must not be broken without a controlled migration process. A breaking change requires a documented migration path, not a silent rename.
9. **Dependency direction is strict**: `Platform → Core Engines → Business Modules → Customer Configuration`. Lower layers never depend on higher layers.
10. **Architecture Decisions Require an ADR** — a major architectural change (a new tenant/security boundary, a provider/stack change, a new Core Engine, a change to a principle in this constitution) is not implemented until it has an Architecture Decision Record in `docs/adr/` with status `Accepted`. See Section 9.

---

# 4. UX Principles

1. The desired experience combines **A. full user control** with **B. proactive system suggestions**. The system works _with_ the user, not _instead of_ the user.
2. Every suggestion, warning or automated result must be visible, explainable, correctable and rejectable. See Section 11.
3. The user interface is Hebrew-first with full right-to-left support from day one. All user-facing text is Hebrew. Internal code, APIs and documentation remain English. Future localization must be possible without architectural changes.
4. Hiding a UI control is a convenience, never a security boundary. See Section 6.

---

# 5. AI Principles

1. AI is an assistance layer, not an autonomous authority. AI is a Core Engine; it is never a business module and never bypasses the platform architecture.
2. AI must: suggest, explain, provide a confidence level, warn about risks or inconsistencies, and never hide relevant information from the user.
3. AI must always allow correction and rejection, and must preserve user control at every step.
4. AI must never perform an irreversible or sensitive business action without explicit user approval.
5. AI executes every action as the requesting user. Every AI action passes the same authorization checks as a human action, and is written to the Audit Log, per ADR-008.
6. AI infrastructure may be implemented later. Workflows, data models and UX architecture must nonetheless be designed from the beginning to carry the concepts AI needs to participate safely: a suggestion, its confidence, its supporting evidence, its explanation, its approval/rejection/correction state, and feedback captured for future improvement. See `ENGINE_MAP.md` (AI Assistance Engine) for the target contract shape.
7. Nera never depends on a single AI provider. Business modules never communicate with an AI provider directly; only the AI Assistance Engine does.

See ADR-001 (Product Philosophy) and ADR-004 (AI Assistance and User Control) in `docs/adr/` for the full decision record behind this section.

---

# 6. Security Principles

1. Never trust the client. Authorization is enforced server-side, always. A client-side permission check is a UX convenience, never a security boundary.
2. Default deny. If no permission rule matches, the result is deny.
3. Multi-tenant isolation is enforced at two independent layers: application logic and PostgreSQL Row Level Security (RLS), scoped by the **Organization** boundary (`organization_id`). Application logic alone is never sufficient. Institution is a separate, optional concept — see Section 7.1 and ADR-002 — and is never itself a tenant/security boundary.
4. Security is part of every feature from the beginning — not a hardening pass added later. A feature without a defined authorization and tenant-isolation story is not ready for implementation.
5. A System Administrator role may bypass business permissions, and an administrator can always delete data — but only subject to explicit authorization, and every such action is fully audited and reviewable. Nothing an administrator does is invisible.
6. Plugins and modules must never bypass authentication, authorization, tenant boundaries, RLS, audit, validation or any other security control. See Section 10.
7. Sensitive data must never be exposed in logs, UI state, or client-side storage beyond what the current view requires.

---

# 7. Data Principles

1. **Multi-Tenant Always** — every relevant table, engine and feature supports multiple organizations from day one. There is no code path that assumes a single-tenant world. **Organization is the tenant and the security boundary.** An Organization may optionally contain one or more Institutions (a business hierarchy below the Organization, not a substitute for it) — a platform customer that has no use for the concept of "institution" is fully supported without one. See ADR-002.
2. Database naming is English, `snake_case`, and tables are pluralized.
3. Primary keys are UUIDs. The repository's currently implemented strategy is whatever the existing schema already uses (Prisma's default `uuid()`, i.e. UUIDv4) — this is the source of truth today. UUIDv7 (time-ordered) is a candidate future improvement, not a current default: adopting it, for new tables or existing ones, requires its own ADR and migration analysis first. See `ROADMAP.md` Section 9.
4. Every business table includes `created_at` and `updated_at`. Soft delete (`deleted_at`) is the default deletion strategy; a hard delete is an explicit, authorized, audited exception — never the default.
5. Foreign keys are enforced and default to `RESTRICT`. Foreign key columns are always indexed, along with other common query paths.
6. Every meaningful business action is recorded in `audit_logs`. Audit records are append-only and are never edited or deleted through normal application behavior. Audit is enforced at the application layer, by a single shared Audit Engine — no engine or module writes its own parallel audit trail.
7. Tenant-scoped tables carry a mandatory `organization_id` (the tenant boundary) and a matching RLS policy keyed on it. A record that belongs to a specific institution may additionally carry an optional `institution_id` — but `institution_id` is never trusted on its own; every access path that uses it must also validate that the institution belongs to the caller's `organization_id`. See `ENGINE_MAP.md` (Organization / Institution Engine) and ADR-002 for the full decision. No schema change implementing this has been made yet — see `ROADMAP.md` for when it is scheduled.

---

# 8. Development Principles

1. All code (files, folders, variables, functions, types, comments, API routes, database names) is English. Hebrew is used only for user-facing UI text.
2. Files are small and focused, with one clear responsibility. Business logic never hides inside UI components.
3. Claude (or any AI contributor) may suggest improvements, identify risks, explain alternatives, and implement approved tasks. Claude may not invent product requirements, make architectural decisions alone, expand scope without approval, add unrequested features, or modify unrelated files.
4. Critical logic must be testable and tested: business rules, permissions, workflows, automation, and tenant isolation require dedicated test coverage, not incidental coverage.
5. Do not optimize prematurely. Do not write code that clearly cannot scale. Performance decisions are based on actual needs or a clearly documented architectural risk.
6. Errors are clear, intentional and safe. User-facing errors never expose internal details. Developer-facing errors carry enough context to debug.

---

# 9. Review and Commit Discipline

1. Every sprint follows: Planning → Execution → Review → Approval → Commit. No sprint is complete until it has been reviewed and committed.
2. Every task is defined with: Objective, Scope, Constraints, Deliverables, Acceptance Criteria. Work outside the approved scope is not performed without going back for approval.
3. Every change is reviewed before approval against: scope compliance, architecture compliance, naming, security, simplicity, and maintainability. A change is never approved solely because "it works."
4. Commits are small, meaningful, and represent one logical change. Commit messages use `type: short description` (for example `feat:`, `fix:`, `docs:`, `chore:`).
5. The `main` branch always remains stable. Nothing is committed to `main` without explicit approval from the person directing the work.
6. Outdated documentation is a defect. When a change makes a canonical document (this constitution, `PRODUCT_VISION.md`, `ROADMAP.md`, `ENGINE_MAP.md`, `MODULE_MAP.md`, or an ADR) inaccurate, updating that document is part of the task, not a follow-up.
7. **Major architectural changes require an ADR before implementation.** A new tenant/security boundary, a provider or stack change, a new Core Engine, or a change to a principle in this constitution is proposed as an ADR in `docs/adr/` (see that directory's `README.md` for status values and the template) and reaches status `Accepted` before any implementation begins.
8. **Claude, or any coding agent, may analyze an architectural question and recommend a decision — it may not resolve an unresolved architectural decision autonomously.** Only the owner moves an ADR to `Accepted`. Where the repository, prior documentation, and new instructions disagree, the agent's job is to surface the conflict precisely (as this constitution and `ROADMAP.md` Section 9 already do), not to pick a side.

---

# 10. Plugin Platform Principles

Nera is designed as an extensible platform. No app marketplace exists yet, and none is being built now — but the architectural boundaries and contracts that would make one possible later must exist from the start.

Where authorized, a plugin or module may extend:

- Navigation
- UI surfaces
- Permissions
- Entity types
- Workflows
- Search
- Reports
- Forms
- Business events
- Document handlers
- Integrations

A plugin or module must **never**:

- Bypass authentication
- Bypass authorization
- Cross tenant boundaries
- Bypass Row Level Security
- Bypass audit
- Bypass validation
- Bypass any other security control

Extension points are stable, versioned contracts owned by the relevant Core Engine (see `ENGINE_MAP.md`, Plugin / Extension Runtime). A future external or internal module connects through these contracts without modifying core code. Until the Plugin / Extension Runtime engine exists, "extension points" are a design discipline applied when building each engine's public contract — not a separate running system.

See ADR-003 (Plugin Platform) in `docs/adr/` for the full decision record behind this section.

---

# 11. Explainability Requirement

Every system suggestion, decision, warning, or automated result must be explainable in terms a user can act on:

- **What** is being suggested, decided, or flagged.
- **Why** — the evidence or rule that produced it.
- **How confident** the system is, where confidence is meaningful.
- **What the user can do**: approve, reject, correct, or ask for more detail.

A feature that cannot answer these four questions is not ready to ship, regardless of whether it is AI-driven or purely rule-driven (for example, a duplicate-entity warning or a permission denial must be just as explainable as a future AI suggestion).

---

# 12. Explicitly Forbidden Patterns

The following are never acceptable, regardless of deadline pressure:

- Hardcoding tenant-specific or institution-specific behavior in platform or engine code.
- Placing industry-specific terminology or logic (for example, yeshiva- or kollel-specific concepts) in the platform core or in a Core Engine. It belongs in a business module.
- Business logic hidden inside a UI component instead of an engine or module service layer.
- A business module importing another business module's internal implementation instead of its public contract.
- A Core Engine depending on a business module.
- Duplicating a Core Engine's logic inside a business module instead of reusing the engine.
- Treating a client-side permission check as sufficient authorization.
- Any AI action that is irreversible or business-sensitive and was not explicitly approved by a user.
- Any AI or automated action that is not written to the Audit Log.
- Skipping the Audit Engine for a meaningful business action, or writing a parallel/private audit mechanism.
- Bypassing Row Level Security, including "temporary" bypasses for convenience.
- A plugin or module extension point that reaches around authentication, authorization, tenant isolation, audit, or validation.
- Breaking a public API or data contract without a documented, controlled migration path.
- Building a generic engine ahead of a real, justified need for it ("overengineering") — see `ROADMAP.md` for which engines are intentionally deferred and why.
- Treating `institution_id` as a tenant/security boundary, or trusting `institution_id` in an access check without also validating it against the caller's `organization_id`. See ADR-002.
- Implementing a major architectural change (a new tenant/security boundary, a provider/stack migration, a new Core Engine) without an ADR at status `Accepted` in `docs/adr/`.
- An AI contributor (or any coding agent) resolving an unresolved architectural decision on its own judgment instead of surfacing it for the owner to decide.

---

# 13. Relationship to Other Documents

Document hierarchy, highest authority first:

1. `docs/NERA_CONSTITUTION.md` — this document. Principles.
2. `docs/PRODUCT_VISION.md` — what Nera is, for whom, and V1 scope. This is the canonical vision document; see item 6 below regarding `docs/PROJECT_VISION.md`.
3. `docs/ROADMAP.md` — how Nera gets built, in what order, and why.
4. `docs/ENGINE_MAP.md` / `docs/MODULE_MAP.md` — the concrete platform and module inventory that implements the above.
5. `docs/adr/*.md` — **the single canonical ADR directory for the entire platform.** Every major architectural change is recorded here as an ADR before implementation, per Section 9. The Foundation Phase's ADRs (monorepo, domain-driven architecture, authorization model) were consolidated into this directory as ADR-006, ADR-007, and ADR-008 during Milestone 1's documentation cleanup — `docs/decisions/` (their original location) now holds only short redirect stubs, not a second source of truth. See `docs/adr/README.md` for the full consolidation history.
6. Legacy foundation documents — `docs/PROJECT_VISION.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/TECH_STACK.md`, `docs/CORE_PLATFORM_BLUEPRINT.md` — remain valid for details not restated or superseded above. They are candidates for consolidation into the documents above in a future milestone; they are not deleted or edited as part of Milestone 1. `docs/PROJECT_VISION.md` specifically is superseded in intent by `docs/PRODUCT_VISION.md` (item 2 above) but is kept as-is, unmerged, until a future approved documentation-cleanup milestone reviews and merges it — see `ROADMAP.md` Section 9. Where any legacy document conflicts with this constitution, this constitution wins, and the conflict should be resolved by updating or retiring the legacy document rather than by silent divergence.

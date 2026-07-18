# ROADMAP.md

# Nera Roadmap

**Version:** 1.0
**Status:** Approved (Milestone 1 content). Milestones 2+ are planned and subject to the exit criteria of the milestone before them.

> This roadmap is milestone-based. Each milestone contains an ordered list of sprints (`P0xx`). A sprint number is only assigned once its milestone is active — sprint scopes beyond the next milestone are directional, not final.
>
> Platform engines and business modules are kept in clearly separate milestones: **Milestone 2 builds platform engines. Milestone 3 builds the first business modules on top of them.** This order is deliberate — see `NERA_CONSTITUTION.md` Section 3 ("Platform First") and Section 12 (forbidden: building business-module logic before the required core engines exist).

---

# 1. Milestone 0 — Platform Foundation (Completed)

Everything up to and including commit `34f5f24`.

| Sprint          | Delivered                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundation docs | `PROJECT_VISION.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `TECH_STACK.md`, ADR-0001..0003 (now consolidated as ADR-006..008 in `docs/adr/`, see Milestone 1), `CORE_PLATFORM_BLUEPRINT.md` |
| P002            | Monorepo bootstrap (workspaces, tooling)                                                                                                                                                   |
| P004            | Database package, initial Prisma schema: `Organization`, `OrganizationUnit`, `UserProfile`, `OrganizationMembership`, `Role`, `Permission`, `RolePermission`, `MembershipRole`, `AuditLog` |
| P005            | Demo login, Hebrew calendar engine, overlay behavior fixes                                                                                                                                 |
| P006            | Application shell and navigation                                                                                                                                                           |
| P007            | Entity Engine (`packages/engines/entities`) and Contacts UI, entirely in-memory — no persistence                                                                                           |

**State at the end of Milestone 0:** a real UI shell and navigation exist; a real domain model exists for entities; a real database schema exists for identity/authorization — but nothing is connected. There is no authentication, no server-side authorization enforcement, no API layer, no audit writes, no event bus, and `modules/` is empty. This is the starting point for Milestone 1.

---

# 2. Milestone 1 — Product Blueprint (Current)

**Objective:** Produce the canonical product and architecture documents that every subsequent milestone is built against, and reconcile every open contradiction between prior documentation, the newly approved product direction, and the actual repository state — without writing or changing any application code.

**Deliverables:**

- `docs/NERA_CONSTITUTION.md`
- `docs/PRODUCT_VISION.md`
- `docs/ROADMAP.md` (this document)
- `docs/ENGINE_MAP.md`
- `docs/MODULE_MAP.md`
- `docs/adr/` — the single canonical ADR directory: `README.md`, `000-template.md`, ADR-001 through ADR-005 (new Milestone 1 decisions), and ADR-006 through ADR-008 (the Foundation Phase's ADRs, consolidated in from `docs/decisions/` as this milestone's final documentation cleanup — see `NERA_CONSTITUTION.md` Section 13 and `docs/adr/README.md`).

**Exit criteria:**

1. All documents above exist and are internally consistent with each other, and with the eight substantive ADRs already `Accepted` (ADR-001 through ADR-008; `000-template.md` is not a decision).
2. Every contradiction found between the new product direction and the existing repository/documentation is explicitly listed (see the Milestone 1 delivery summary) — not silently resolved.
3. The owner has reviewed and approved this document set, including the open decisions listed in Section 9 below.
4. No application code, database schema, package structure, or dependency was modified to produce this milestone.

**This milestone does not start P008.** P008 is the first sprint of Milestone 2 and only begins after this milestone is approved.

---

# 3. Milestone 2 — Architecture Finalization & Platform Core

**Objective:** Close every architectural gap identified in Milestone 1 and stand up the platform engines that every future business module depends on: identity, authorization enforcement, audit, events, tenant isolation, and persistence for the existing Entity/Configuration domain model. No business module is built in this milestone.

**Why this milestone exists before any business module:** `NERA_CONSTITUTION.md` forbids building business-module logic before the required core engines exist. Today, Authentication is a demo stub, Authorization is enforced only client-side (and is explicitly documented in its own source as not a security boundary), the `audit_logs` table has no writer, no event bus exists, and there is no API layer at all. None of that can be inherited "for free" by a business module — it must exist first.

### Sprints

| Sprint   | Name                                           | Type                                  | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ---------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P008** | Architecture Finalization & Platform Bootstrap | Architecture + Infrastructure         | **Not documentation-only.** The Organization/Institution hierarchy is already decided in Milestone 1 (ADR-002); P008 does not re-open it. P008 produces the ADR(s) still needed to close what Milestone 1 left genuinely open (the database/auth/storage provider/stack, see Section 9; and the concrete RLS/migration design that implements ADR-002's `organization_id` + optional `institution_id` model), **and** performs the first justified infrastructure work on whatever provider that ADR confirms: establishing the schema/migration tooling baseline, and wiring a real Identity/Authentication foundation (session handling, SSR cookies, middleware) to replace `demoAuth.ts`. This is the first sprint where a real, authenticated request can reach a real server. |
| **P009** | Testing & CI Foundation                        | Infrastructure                        | Vitest conventions applied consistently across engines, a Playwright scaffold, and a CI pipeline (lint + typecheck + test) gating every change from this point forward. Only one test file exists in the repository today; this closes that gap before further engine work begins.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **P010** | Audit Engine & Business Event Bus              | Engine implementation                 | Wires real writes to the existing (currently unused) `audit_logs` table, and introduces an in-process domain event bus, per `NERA_CONSTITUTION.md` ("in-process domain events", not a distributed queue at this stage). Ordered before Authorization enforcement so that the first real permission changes are already audited.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **P011** | Authorization Engine — Server Enforcement      | Engine implementation (+ persistence) | Turns the existing client-side resolver (`packages/engines/authorization`) into a real server-side enforcement engine, reusing the `Role` / `Permission` / `RolePermission` / `MembershipRole` tables that already exist from P004. Adds the RLS policy template applied to every table from this point on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **P012** | Organization / Institution Engine              | Engine implementation (+ persistence) | Implements the Organization/Institution model already decided by ADR-002 (Milestone 1): an `institutions` table under `Organization`, RLS keyed on `organization_id`, and the organization-ownership check required before any `institution_id` is trusted. Applies this (and RLS generally) retroactively to the P004 identity tables.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **P013** | Entity & Configuration Persistence             | Persistence                           | Connects the existing Entity Engine and Customization/Settings engines to real, tenant-isolated, audited, event-emitting persistence. The existing Contacts UI is repointed from its in-memory context to the real API — this is the milestone where "Contacts" stops being a demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Exit criteria for Milestone 2:**

1. A user authenticates for real; there is no code path that reaches protected data without a valid, server-verified session.
2. Every authorization decision is enforced server-side and is independently auditable.
3. Every meaningful mutation writes an audit record and emits a domain event, verified by test, not just by code review.
4. Two organizations cannot see each other's data — verified by an explicit automated RLS test keyed on `organization_id` (ADR-002). Where institutions are used, one organization's institutions are never reachable from another organization's `institution_id` lookups.
5. The Contacts module operates against real persisted data with no data loss on refresh or across sessions.
6. CI blocks a PR that fails lint, typecheck, or tests.

---

# 4. Milestone 3 — First Business Value: Suppliers & Finance

**Objective:** Deliver the full flow `Supplier → Purchase Order → Invoice → Payment Approval → MASAV → Mark Paid → Store Documents`, end to end, on real data. This is the first milestone that produces business modules under `modules/`.

**Why this milestone is next:** Per `PRODUCT_VISION.md` Section 6, Suppliers and Finance are explicitly the first areas meant to make Nera "feel alive." Every other V1 module (Reporting, Forms, Search) is downstream of this data existing.

### Sprints

| Sprint   | Name                                | Type                          | Summary                                                                                                                                                                                                                                                                                                                         |
| -------- | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P014** | Document Engine                     | Engine implementation         | File storage and basic PDF handling, needed before Invoices (attachments) and Purchase Orders (quotes).                                                                                                                                                                                                                         |
| **P015** | Workflow Engine (V1 scope)          | Engine implementation         | Sequential approval steps, exposed as "my pending approvals" in-app. Deliberately does not depend on a Notification Engine (deferred, see `PRODUCT_VISION.md` Section 5) — approvals are visible in-app, not pushed through a channel.                                                                                          |
| **P016** | Suppliers Module                    | Business module               | The first module under `modules/`: supplier profile built on the Entity Engine (an organization/person entity plus a supplier role and module profile), branches, and contacts. Establishes the `modules/<name>` packaging pattern every later module follows.                                                                  |
| **P017** | Purchase Orders Module              | Business module               | Purchase orders against a Supplier, with Workflow-driven approval and Document attachments.                                                                                                                                                                                                                                     |
| **P018** | Invoices / Documents Module         | Business module               | Supplier invoices, linked to a Purchase Order, with a stored source document. Data model explicitly separates "confirmed" fields from a "proposed/extracted" shape reserved for the future AI-assisted flow (see `PRODUCT_VISION.md` Section 7 and `ENGINE_MAP.md`, AI Assistance Engine), without implementing extraction now. |
| **P019** | Payment Approval & Payments Modules | Business module               | Payment Approval as a Workflow application (amount-threshold rules, per ADR-008's own example); Payments as the resulting ledger entries and "mark paid" action.                                                                                                                                                                |
| **P020** | MASAV Integration                   | Business module / integration | Produces a valid MASAV batch file from approved Payments. Requires a sandbox/test mode before any connection to a real clearing path, given the blast radius of a real-money error.                                                                                                                                             |

**Exit criteria for Milestone 3:**

1. A real invoice can be taken from Supplier → Purchase Order → Invoice → Payment Approval → MASAV → Mark Paid → Store Documents, in a non-production environment, with no manual database steps.
2. Every step in the flow is authorized, tenant-isolated, and audited.
3. A generated MASAV file passes format validation in sandbox mode.
4. `modules/suppliers`, `modules/purchase-orders`, `modules/invoices`, `modules/payments` exist as independently identifiable packages, none of them importing another module's internals directly.

---

# 5. Milestone 4 — V1 Completion: Reporting, Forms, Search

**Objective:** Complete the remaining V1 scope items from `PRODUCT_VISION.md` Section 4, all of which are consumers of the real data Milestone 3 now produces.

**Why this milestone is next, not earlier:** Building Reporting or Search before Milestone 3's modules exist would mean designing against no real data — a documented anti-pattern (see `NERA_CONSTITUTION.md` Section 12, "building a generic engine ahead of a real, justified need for it").

### Sprints

| Sprint   | Name                        | Type                  | Summary                                                                                                                                                                                                  |
| -------- | --------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P021** | Reporting Engine (baseline) | Engine implementation | A small number of concrete Supplier/Finance reports, not a generic report builder, replacing the static demo dashboard.                                                                                  |
| **P022** | Forms Module                | Business module       | Structured data collection built on the existing Customization/Configuration capability.                                                                                                                 |
| **P023** | Global Search (baseline)    | Engine implementation | PostgreSQL full-text search across Entities and V1 module data, filtered through the same authorization check as every other read path. Elasticsearch remains a documented future upgrade, not V1 scope. |

**Exit criteria for Milestone 4:**

1. Reports return correct, tenant-scoped, permission-filtered results against real Milestone 3 data.
2. A submitted form's data is stored, auditable, and retrievable.
3. Global Search never returns a result the searching user is not authorized to see.

---

# 6. Milestone 5 — Production Hardening & V1 Launch

**Objective:** Verify, under adversarial scrutiny, everything the previous milestones assumed about security and tenant isolation, then deploy and go live.

### Sprints

| Sprint   | Name                               | Type                                  | Summary                                                                                                                                                                                                      |
| -------- | ---------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P024** | Multi-Tenant & RLS Security Review | Production hardening                  | A systematic audit of every table and endpoint introduced since P008 — not the first implementation of RLS (that happened per-table starting in P011/P012), but the final, comprehensive verification of it. |
| **P025** | Deployment & Observability         | Production hardening / infrastructure | Deployment pipeline, structured logging, monitoring/tracing, secrets management appropriate for production, backup and restore — including an actual, tested restore, not a theoretical one.                 |
| **P026** | V1 Release Gate                    | Production hardening                  | UAT with the real institution, data migration plan (if applicable), go-live checklist, rollback plan, support runbook.                                                                                       |

**Exit criteria for Milestone 5 (= V1 launch):**

All `PRODUCT_VISION.md` Section 9 success criteria are met in production, with a real institution using the system for its real supplier/finance workflow.

---

# 7. Post-V1 — Future Milestones (Not Scheduled)

These are explicitly deferred by `PRODUCT_VISION.md` Section 5, or newly introduced by this blueprint as future work. They are listed so the roadmap doesn't need to be renegotiated when they come up, not because they are committed to a date.

- **Employees module** — reuses the Entity + role + module-profile pattern proven by Suppliers.
- **Students module**, **Avreichim module** — both depend on the Finance core proven in Milestone 3; both carry institution-specific terminology that must stay inside the module.
- **Notification Engine (full)** — multi-channel delivery, templates, escalation, on top of the Business Event Bus already built in Milestone 2.
- **Automation Engine** — condition/schedule-driven automation with mandatory test mode, preview, and emergency stop, per `ARCHITECTURE.md`.
- **AI Assistance Engine (real implementation)** — implements the invoice email-ingestion flow documented in `PRODUCT_VISION.md` Section 7, on top of a new **Integration Engine** for inbound email/document sources.
- **Plugin / Extension Runtime (running system)** — Milestone 2 onward designs every engine's public contract as if a plugin could one day sit behind it (`NERA_CONSTITUTION.md` Section 10); an actual runtime and marketplace remain future work.
- **Search upgrade** — Elasticsearch, if PostgreSQL full-text search proves insufficient at real data volume.
- **Assets, Inventory, CRM modules** — named in `MODULE_MAP.md` as recognized future modules with no committed design yet.

---

# 8. Dependency Graph (Text Form)

```
Milestone 1 (Blueprint)
  └─▶ P008 (Architecture finalization + Identity/Auth bootstrap)
        └─▶ P009 (Testing & CI)
              └─▶ P010 (Audit + Event Bus)
                    └─▶ P011 (Authorization server enforcement)
                          └─▶ P012 (Organization / Institution + RLS)
                                └─▶ P013 (Entity + Configuration persistence)
                                      ├─▶ P014 (Document Engine)
                                      ├─▶ P015 (Workflow Engine)
                                      │
                                      └─▶ P016 (Suppliers module)
                                            └─▶ P017 (Purchase Orders) ── needs P014 + P015
                                                  └─▶ P018 (Invoices) ── needs P014
                                                        └─▶ P019 (Payment Approval + Payments) ── needs P015
                                                              └─▶ P020 (MASAV)

  Milestone 3 complete (real Supplier/Finance data exists)
        └─▶ P021 (Reporting)
        └─▶ P022 (Forms) ── needs P013 + P014 + P015
        └─▶ P023 (Global Search) ── needs data from P016-P020

  Milestone 4 complete
        └─▶ P024 (RLS/Security audit) ── needs everything above
              └─▶ P025 (Deployment & Observability)
                    └─▶ P026 (V1 Release Gate)
```

---

# 9. Open Decisions

Milestone 1 surfaced several contradictions between early product direction, the existing repository, and prior documentation. The owner has since resolved some of them directly (recorded as `Accepted` ADRs in `docs/adr/`); others remain genuinely open and are P008's job to close, not this milestone's. This section separates the two so Milestone 2 starts from a precise list rather than rediscovering anything mid-sprint.

## 9.1 Resolved in Milestone 1 (see the cited ADR — no further debate needed)

1. **Organization vs. Institution** — **resolved by ADR-002.** Organization is the tenant and security boundary; RLS remains keyed on `organization_id`. Institution is an optional business hierarchy _below_ Organization, never a substitute tenant boundary; `institution_id`, where used, is always validated against organization ownership. No schema change has been made yet — implementing this (an `institutions` table, optional `institution_id` columns, the RLS/ownership-check pattern) is scheduled as its own future sprint (candidate: P012, "Organization / Institution Engine"), not decided by this roadmap entry alone.
2. **Package naming** — **resolved: no renames.** The existing package names (`packages/database`, `packages/types`, `packages/ui`, etc.) remain authoritative and are not renamed to `packages/db`/`packages/core`/`packages/ui-kit`. A future `packages/core` package may be _added_ (not substituted in) later, but only once it has a clearly defined responsibility not already owned by `packages/types` or `packages/engines` — and only via its own ADR when that need is real, not speculatively now.
3. **UUID version** — **resolved: no migration.** The repository's currently implemented UUID strategy (Prisma's default `uuid()`, i.e. UUIDv4) is the source of truth and is not changed in Milestone 1 or by this roadmap. UUIDv7 remains a candidate future decision, requiring its own ADR plus a migration analysis, before it is adopted for any table, new or existing.
4. **`docs/PROJECT_VISION.md` vs. `docs/PRODUCT_VISION.md`** — **resolved which is canonical: `docs/PRODUCT_VISION.md`**, by owner decision. `docs/PROJECT_VISION.md` is explicitly **not** deleted or rewritten in Milestone 1. **Deprecation/merge note:** `docs/PROJECT_VISION.md` must be reviewed against `docs/PRODUCT_VISION.md` and merged (bringing forward anything not already captured) before it is removed, as its own later approved documentation-cleanup milestone — not implicitly, and not as a side effect of any other sprint.

## 9.2 Still Open — P008 Must Resolve

1. **Database / ORM / authentication / storage provider.** Prior product input mentioned Supabase, Drizzle, Better Auth, and MinIO as a possible direction; **none of these is adopted, confirmed, or rejected by this document.** The repository's actual, implemented, confirmed tooling today is Prisma (`packages/database`) against a self-hosted-style PostgreSQL target, per `TECH_STACK.md` — that remains the source of truth **until a dedicated ADR is approved.** P008 must formally inspect and decide the stack differences (Prisma vs. any alternative; the authentication provider; the storage provider) before any migration, and must produce that ADR before writing schema or auth code against a different stack than what exists today. Until then, every document in this blueprint uses provider-neutral language for anything not already implemented — see ADR-005 (Vendor Abstraction and Integration Engine), which fixes _how_ providers are accessed but deliberately does not select one.

This is now the only stack-related item P008 needs to resolve from scratch; items 9.1.1–9.1.3 above give P008 a settled starting position instead of three more open questions.

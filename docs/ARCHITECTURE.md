# ARCHITECTURE.md

# Nera Platform Architecture

**Version:** 1.0  
**Status:** Approved — legacy foundation document (predates `NERA_CONSTITUTION.md`/ADR-002/`ENGINE_MAP.md`). Per `NERA_CONSTITUTION.md` §13, it remains valid only for details not restated or superseded by the Constitution, the ADRs, or `ENGINE_MAP.md`. **Verified, corrected below (P013A documentation closeout) where it directly conflicted with the current, higher-precedence architecture:** Section 5 (Core Engines list), Section 7 (Tenant Model), Section 17 (Audit Engine's field list), and Section 18 (`tenant_id`). Each correction is marked inline; the surrounding, non-conflicting text is unchanged.

---

# 1. Architecture Purpose

This document defines the technical architecture of the Nera Platform.

It is binding for all future development.

Every implementation, module, engine, database change, API, UI feature and AI-assisted task must follow this architecture.

If a requested feature conflicts with this document, development must stop and the conflict must be reviewed before implementation.

---

# 2. Product Model

Nera is a universal business platform.

The ERP is the first product built on top of the platform.

The architecture must support:

- SaaS deployment
- Future on-premise deployment
- Multiple tenants
- Multiple organizations per tenant
- Users belonging to multiple tenants
- Configurable business modules
- Reusable core engines
- AI as a native platform assistant
- Long-term extensibility

**Correction (P013A documentation closeout, per ADR-002 — Accepted; see Section 7's
correction for the full decision):** "Multiple tenants" and "Multiple organizations per
tenant" above restate the superseded tenant-above-organization model. **Organization is the
tenant** — read these two bullets as "Multiple organizations (each its own tenant)" and "Each
organization may optionally contain one or more Institutions," not as two separate hierarchy
levels.

---

# 3. Core Architecture Model

Nera is built in layers.

```
Platform
  ↓
Core Engines
  ↓
Business Modules
  ↓
Customer Configuration
```

Dependency direction is strict.

Higher layers may depend on lower layers.

Lower layers must never depend on higher layers.

---

# 4. Platform Layer

The Platform Layer provides the technical foundation.

It includes:

- Repository structure
- Authentication foundation
- Authorization foundation
- Tenant isolation
- Database conventions
- Event system
- Configuration system
- Shared utilities
- Development standards

The Platform Layer must remain industry-neutral.

It must never contain business assumptions that belong to a specific industry.

---

# 5. Core Engines

Core Engines are reusable platform services.

They are not business modules.

They are shared infrastructure used by business modules.

Approved Core Engines:

- Authentication Engine
- Authorization Engine
- Audit Engine
- Event Engine
- Workflow Engine
- Automation Engine
- Notification Engine
- Document Engine
- Search Engine
- Reporting Engine
- Dashboard Engine
- Settings Engine
- Customization Engine
- AI Engine

**Correction (P013A documentation closeout): this list is incomplete and must not be read as
the current engine inventory.** `docs/ENGINE_MAP.md` is the authoritative, up-to-date engine
inventory (`NERA_CONSTITUTION.md` §13) and additionally includes: **Organization / Institution
Engine** (the tenant boundary itself — ADR-002; real and persisted since P012), **Entity
Engine** (real and persisted for the person side since P013A), **Business Event Bus** (this
list's "Event Engine," renamed and real since P010), **Integration Engine** (approved by
ADR-005; not yet implemented), and **Plugin / Extension Runtime** (a registration skeleton
exists since P008/ADR-010). Do not add a new engine anywhere in the platform based on this
list alone without cross-checking `docs/ENGINE_MAP.md` first.

Core Engines should live under:

`packages/engines`

unless a future architecture decision changes this.

---

# 6. Business Modules

Business Modules implement business capabilities.

Examples:

- CRM
- Customers
- Suppliers
- Purchasing
- Inventory
- Finance
- Accounting
- Sales
- Projects
- Human Resources
- Manufacturing
- Membership
- Service Management

Business modules live under:

`modules/`

The `modules/` folder is reserved for business modules only.

Business modules must remain independent.

A business module must not directly import another module’s internal code.

---

# 7. Tenant Model

Nera supports multiple tenants.

A tenant represents a customer account or organization group.

A tenant may contain multiple organizations, branches, institutions, companies or departments.

Users may belong to multiple tenants.

Access must always be evaluated in tenant context.

Tenant data isolation is mandatory.

Data from one tenant must never be visible to another tenant.

This must be enforced both at the application layer and at the database layer.

**Correction (P013A documentation closeout, per ADR-002 — Accepted):** the paragraph above,
describing a "tenant" as a separate concept that may contain multiple organizations, is
superseded. **Organization is the tenant and the sole security boundary — there is no
separate tenant concept above it.** An Organization may optionally contain one or more
Institutions (a business hierarchy strictly below the Organization, never a substitute for
it, and never itself a security boundary — ADR-002 Decision items 1–3). Row Level Security is
keyed on `organization_id` only. **This correction governs every other use of "tenant"
anywhere else in this document, not only this section** — everywhere this document says
"tenant," read "Organization"; everywhere it lists "branches, institutions, companies or
departments" as peers of "organizations," read those as optional structure _within_ one
Organization, not alongside it. Sections 2 and 16 restate the same superseded model most
directly and are corrected inline below; every other, milder use of "tenant" in this
document (e.g. "per tenant," "tenant isolation," "tenant-scoped") should be read the same way
without needing its own repeated correction.

---

# 8. Row Level Security

Row Level Security is required from day one.

Every tenant-scoped table must support tenant isolation.

Application logic alone is not enough.

Database-level protection must exist so that even application bugs cannot expose tenant data across tenants.

---

# 9. Module Activation

Every business module should be enableable or disableable per tenant.

A tenant should not be forced to use every module.

This supports progressive complexity.

Small organizations should see a simple system.

Large organizations should be able to enable advanced capabilities.

---

# 10. Event-Driven Architecture

Nera uses an internal Event Bus from day one.

Events are the preferred way for modules and engines to communicate.

Examples:

- EntityCreated
- EntityUpdated
- WorkflowStarted
- WorkflowApproved
- DocumentUploaded
- NotificationRequested
- AutomationTriggered
- AuditRecorded

Business modules publish events.

Core Engines may consume and publish events.

Modules should not call each other directly unless an explicit public interface exists.

---

# 11. Workflow Engine

Workflow is a Core Engine.

Business modules must not implement their own approval logic.

Instead, modules expose workflow-capable actions and the Workflow Engine manages:

- Steps
- Approvals
- Rejections
- Status changes
- Escalations
- Permissions
- History

Workflows must be configurable per tenant.

---

# 12. Automation Engine

Automation is a Core Engine.

Automations perform actions based on events, conditions and schedules.

Automation must support:

- Active mode
- Test mode
- Preview
- Approval where needed
- Audit logging
- Emergency stop

Automation must never bypass permissions, workflows or business rules.

Test mode is mandatory so users can verify what would happen before enabling real execution.

---

# 13. Notification Engine

Notifications are handled by a Core Engine.

Business modules should not send notifications directly.

They should publish events or notification requests.

The Notification Engine manages:

- Recipients
- Channels
- Timing
- Conditions
- Escalation
- Templates
- Delivery status

Notification rules must be configurable per tenant.

---

# 14. AI Engine

AI is a Core Engine.

AI is not a business module.

AI should behave like a knowledgeable internal assistant.

The AI should eventually be able to:

- Answer questions about system data
- Help users understand how to perform actions
- Explain workflows
- Summarize information
- Find records
- Detect anomalies
- Suggest next steps
- Assist with configuration

AI must respect:

- Permissions
- Tenant boundaries
- Workflow rules
- Audit requirements
- Data access policies

AI must never bypass platform architecture.

AI should access business modules only through approved interfaces.

---

# 15. Customization Engine

Customization is a Core Engine.

Nera must support configuration without code whenever possible.

Configurable areas include:

- Fields
- Forms
- Lists
- Statuses
- Dashboards
- Reports
- Workflows
- Notifications
- Automations
- Permissions

Configuration should be tenant-scoped unless explicitly defined as global.

---

# 16. Settings Engine

Settings are platform-level infrastructure.

Settings may exist at multiple levels:

- System
- Tenant
- Organization
- Module
- User

**Correction (P013A documentation closeout, per ADR-002 — Accepted; see Section 7's
correction for the full decision):** "Tenant" and "Organization" above are not two separate
levels — that predates ADR-002. **Organization is the tenant.** Read the level list as:
System, Organization, Module, User (Institution, where an Organization uses one, is an
optional additional level below Organization, per ADR-002 — not listed here since no
Institution-scoped setting has been built yet).

Hardcoded tenant behavior is forbidden.

If behavior may differ between customers, it should be represented as configuration.

---

# 17. Audit Engine

Audit is mandatory.

Every meaningful action must be recorded.

Audit records should include:

- Actor
- Tenant
- Organization if relevant
- Action
- Entity type
- Entity ID
- Previous value
- New value
- Timestamp
- Source
- Context

Audit records must be append-only.

They must not be edited or deleted through normal application behavior.

**Correction (P013A documentation closeout, per ADR-002):** "Tenant" and "Organization if
relevant" above are not two separate fields — that phrasing predates ADR-002. The real,
implemented `AuditLog` model (`packages/database/prisma/schema.prisma`, real since P004,
written to via `@nera/audit-engine`'s `recordAudit()` since P010) has a single
`organizationId` column, not a separate tenant/organization pair. Read "Actor / Tenant /
Organization if relevant" above as "Actor / Organization" (mandatory, not conditional).

---

# 18. Database Philosophy

Database naming is English only.

Rules:

- Tables use snake_case
- Tables use plural names
- Primary keys are UUID
- Every business table includes created_at and updated_at
- Business tables should support soft delete where appropriate
- Foreign keys must be enforced
- Tenant-scoped tables must include tenant_id
- Important tables should include created_by and updated_by where relevant
- Indexes must be added for foreign keys and common query paths

**Correction (P013A documentation closeout, per ADR-002 and `NERA_CONSTITUTION.md` §7.7):**
the "Tenant-scoped tables must include `tenant_id`" rule above is superseded. No table in the
repository has ever had a `tenant_id` column. Every tenant-scoped table carries
`organization_id` (mandatory) and, optionally, an organization-validated `institution_id`
(additive only, never trusted alone — ADR-002 Decision item 5). Read "tenant_id" above as
"organization_id."

The database must prioritize integrity over convenience.

---

# 19. Language Rules

Source code is English.

Database names are English.

API names are English.

Internal documentation is English.

The user interface is Hebrew.

The UI must support full RTL from day one.

All user-facing text must be Hebrew.

Future localization must be possible without architecture changes.

---

# 20. Repository Structure

Approved repository structure:

```
/
├── README.md
├── CLAUDE.md
├── docs/
│   ├── PROJECT_VISION.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   ├── ROADMAP.md
│   └── adr/
├── apps/
├── packages/
│   └── engines/
├── modules/
├── scripts/
└── tools/
```

**Correction (P013A documentation closeout):** the tree above is updated to `docs/adr/`,
replacing `docs/decisions/`. `docs/adr/` is the single canonical Architecture Decision Record
directory (see `docs/adr/README.md`); `docs/decisions/` now holds only short redirect stubs
pointing there, not a second source of truth, and nothing new is added to it.

Folder responsibilities:

`apps/`  
Deployable applications.

`packages/`  
Shared platform packages.

`packages/engines/`  
Core Engines.

`modules/`  
Business Modules only.

`docs/`  
Project documentation.

`docs/adr/`  
Architecture Decision Records (canonical location — see correction above).

`scripts/`  
Automation and developer scripts.

`tools/`  
Internal development tools.

---

# 21. Dependency Rules

Allowed:

```
Business Module → Core Engine
Business Module → Platform Contract
Core Engine → Platform Utility
App → Business Module
App → Core Engine
```

Forbidden:

```
Core Engine → Business Module
Platform → Business Module
Business Module → Business Module internals
UI Component → Database directly
Client Code → Trusted Authorization Logic
```

Server-side authorization is mandatory.

Never trust the client.

---

# 22. Extension Rules

New capabilities must be added in the correct layer.

If a capability is reusable, it belongs in a Core Engine.

If a capability is industry-specific, it belongs in a Business Module.

If a capability is customer-specific, it belongs in Configuration.

If a capability affects architecture, it requires review before implementation.

---

# 23. Deployment Model

Nera must support SaaS first.

The architecture should also allow future on-premise deployment.

This means:

- Avoid vendor lock-in where practical
- Keep configuration portable
- Keep tenant isolation explicit
- Keep infrastructure assumptions documented
- Do not hardcode deployment-specific behavior into business logic

---

# 24. Non-Negotiable Rules

The following rules are mandatory:

- Platform first
- Tenant isolation
- RLS from day one
- Audit for meaningful actions
- Event-driven communication
- No direct module-to-module internals
- Hebrew RTL UI
- English codebase
- Configuration over hardcoded behavior
- Core Engines before duplicated logic
- AI must respect permissions
- Automation must support test mode
- Architecture wins over speed

---

# 25. Final Principle

Nera is built for long-term growth.

Every technical decision must make the platform easier to extend, easier to maintain and safer to operate.

If a shortcut creates future complexity, it is not allowed.

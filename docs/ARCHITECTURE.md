# ARCHITECTURE.md

# Nera Platform Architecture

**Version:** 1.0  
**Status:** Approved

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
│   └── decisions/
├── apps/
├── packages/
│   └── engines/
├── modules/
├── scripts/
└── tools/
```

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

`docs/decisions/`  
Architecture Decision Records.

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

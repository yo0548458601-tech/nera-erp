# CORE_PLATFORM_BLUEPRINT.md

# Nera Core Platform Blueprint

**Version:** 1.0  
**Status:** Approved

---

# 1. Purpose

This document closes the Foundation Phase of Nera Platform.

It summarizes the approved architectural foundation and defines the transition into the Platform Phase.

The Foundation Phase established the rules.

The Platform Phase will begin building the system.

---

# 2. Approved Foundation

The following foundation documents are approved:

- PROJECT_VISION.md
- ARCHITECTURE.md
- DEVELOPMENT.md
- TECH_STACK.md
- ADR-0001 — Monorepo Architecture
- ADR-0002 — Domain Driven Architecture
- ADR-0003 — Authorization Model

These documents are binding for all future development.

---

# 3. Platform Direction

Nera is a universal business platform.

The ERP is the first product built on top of the platform.

The architecture must support:

- SaaS deployment
- Future on-premise deployment
- Multi-tenant operation
- Multiple organizations per tenant
- Users belonging to multiple tenants
- Configurable business modules
- Core Engines
- AI as a native platform assistant
- Long-term extensibility

---

# 4. Core Platform Responsibilities

The Core Platform is responsible for:

- Identity
- Authentication
- Authorization
- Tenant isolation
- Organization structure
- Event system
- Audit logging
- Configuration
- Settings
- Workflow foundation
- Automation foundation
- Notification foundation
- AI Engine foundation
- Document infrastructure
- Search foundation
- Shared UI foundation
- Developer tooling

Business modules must not reimplement these responsibilities.

---

# 5. Core Engines

The following Core Engines are approved:

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

Core Engines are platform infrastructure.

They are not business modules.

---

# 6. Business Module Rules

Business modules live under:

modules/

Business modules must:

- Remain independent
- Own their business rules
- Avoid direct dependency on other modules
- Communicate through services, contracts or events
- Use Core Engines instead of duplicating infrastructure
- Respect tenant isolation
- Respect authorization
- Emit audit-relevant events
- Be removable without breaking unrelated modules

---

# 7. AI Rules

AI is a Core Engine.

AI must:

- Respect tenant boundaries
- Respect authorization
- Act as the requesting user
- Use approved services only
- Never bypass workflows
- Never bypass business rules
- Record meaningful actions in the Audit Log

The AI should behave like an internal assistant that knows the system and helps users act safely.

---

# 8. Platform Phase Entry Criteria

The Platform Phase may begin only after:

- Foundation documents are committed
- ADR-0001, ADR-0002 and ADR-0003 are committed
- Git history is clean
- The main branch is stable
- The workspace structure exists
- The technology stack is approved

---

# 9. First Platform Objectives

The Platform Phase should begin with:

1. Monorepo tooling implementation
2. Next.js application foundation
3. TypeScript configuration
4. ESLint and Prettier
5. Shared package structure
6. Core database package
7. Identity foundation
8. Tenant model foundation
9. Authorization foundation
10. Hebrew RTL UI foundation

No business module should be built before the platform foundation exists.

---

# 10. Non-Negotiable Rules

The following rules remain mandatory:

- Architecture before implementation
- Configuration before hardcoding
- Core Engines before duplicated logic
- Tenant isolation from day one
- Authorization everywhere
- Audit for meaningful actions
- AI never bypasses permissions
- Business modules remain independent
- Hebrew RTL UI
- English codebase
- Git commit after every approved sprint

---

# 11. Transition Statement

The Foundation Phase is complete when this document is committed.

After that, Nera may enter the Platform Phase.

The next phase is not about building ERP features.

It is about building the platform foundation that will allow ERP features to exist safely, consistently and at scale.

---

# Final Principle

Nera must become easier to extend as it grows.

Every platform decision must protect that principle.

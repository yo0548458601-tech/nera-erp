# ADR-0001 — Monorepo Architecture

Status: Accepted

Date: 2026-07-09

---

# Context

Nera is intended to become a complete business platform serving organizations of every size.

The platform will eventually include:

- ERP
- CRM
- Finance
- HR
- Inventory
- Projects
- Documents
- Automation
- AI
- Reporting
- Additional future modules

Many capabilities will be shared across every module.

Examples include:

- Authentication
- Permissions
- Notifications
- AI
- Database
- UI Components
- Shared Types
- Automation
- Logging

Maintaining these capabilities in separate repositories would create duplication and long-term maintenance problems.

---

# Decision

Nera will use a single Monorepo.

The repository will contain:

apps/

packages/

modules/

docs/

scripts/

tools/

Reusable functionality belongs inside packages.

Business functionality belongs inside modules.

Applications belong inside apps.

---

# Consequences

Benefits:

- Single source of truth
- Shared code without duplication
- Consistent architecture
- Easier refactoring
- Easier dependency management
- Unified versioning
- Better developer experience

Trade-offs:

- Larger repository
- Requires disciplined architecture
- Requires clear module boundaries

These trade-offs are acceptable.

---

# Alternatives Considered

Multiple repositories.

Rejected because:

- Duplicate infrastructure
- Difficult synchronization
- Higher maintenance cost
- Harder cross-module refactoring
- Poorer developer experience

---

# Final Decision

The Nera Platform will be developed as a Monorepo from day one.

Future architectural decisions must remain compatible with this decision.

Changing this decision requires a new ADR.

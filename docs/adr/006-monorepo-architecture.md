# ADR-006 — Monorepo Architecture

**Status:** Accepted
**Date:** 2026-07-09
**Migration note:** Originally recorded as `ADR-0001` in `docs/decisions/ADR-0001-monorepo.md` during the Foundation Phase. Migrated here unchanged in substance as part of the Milestone 1 ADR consolidation (see `docs/adr/README.md`); the original approval date is preserved. `docs/decisions/ADR-0001-monorepo.md` now redirects here.

---

## Context

Nera is intended to become a complete business platform serving organizations of every size.

The platform will eventually include: ERP, CRM, Finance, HR, Inventory, Projects, Documents, Automation, AI, Reporting, and additional future modules.

Many capabilities are shared across every module — for example: Authentication, Permissions, Notifications, AI, Database, UI Components, Shared Types, Automation, Logging.

Maintaining these capabilities in separate repositories would create duplication and long-term maintenance problems.

## Decision

Nera uses a single Monorepo. The repository contains:

```
apps/
packages/
modules/
docs/
scripts/
tools/
```

Reusable functionality belongs inside `packages/`. Business functionality belongs inside `modules/`. Applications belong inside `apps/`.

## Consequences

**Benefits:** single source of truth; shared code without duplication; consistent architecture; easier refactoring; easier dependency management; unified versioning; better developer experience.

**Trade-offs:** larger repository; requires disciplined architecture; requires clear module boundaries. These trade-offs are accepted.

## Alternatives Considered

**Multiple repositories** — rejected: duplicate infrastructure, difficult synchronization, higher maintenance cost, harder cross-module refactoring, poorer developer experience.

## Follow-up Actions

- The Nera Platform is developed as a Monorepo from day one; every subsequent ADR and every milestone in `docs/ROADMAP.md` assumes this structure.
- Changing this decision requires a new ADR that explicitly supersedes this one — it is not to be quietly abandoned.
- This decision remains in effect and implemented; no further action is pending from it as of Milestone 1.

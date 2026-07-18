# docs/decisions/ (Deprecated Location)

This directory is **no longer the canonical ADR location.** During Milestone 1's documentation cleanup, all ADRs were consolidated into [`docs/adr/`](../adr/README.md), which is now the single canonical ADR directory for the platform.

The three ADRs originally recorded here have moved:

| Original file                     | Canonical location                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `ADR-0001-monorepo.md`            | [`docs/adr/006-monorepo-architecture.md`](../adr/006-monorepo-architecture.md)           |
| `ADR-0002-domain-driven.md`       | [`docs/adr/007-domain-driven-architecture.md`](../adr/007-domain-driven-architecture.md) |
| `ADR-0003-authorization-model.md` | [`docs/adr/008-authorization-model.md`](../adr/008-authorization-model.md)               |

Each original file remains in place as a short redirect stub, not a duplicate — the substantive content lives only under `docs/adr/`. No new ADR should be added to this directory; use `docs/adr/000-template.md` going forward.

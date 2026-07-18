# Architecture Decision Records

This directory is the **single, canonical ADR location for the entire platform.**

An ADR is a short, point-in-time record of one architectural decision: what was decided, why, what alternatives were considered, and what it implies going forward. ADRs are the canonical architectural decision history for the platform, referenced by `docs/NERA_CONSTITUTION.md`, `docs/ROADMAP.md`, `docs/ENGINE_MAP.md`, and `docs/MODULE_MAP.md`.

**Rule:** a major architectural change is not implemented until it has an ADR with status `Accepted`. See `NERA_CONSTITUTION.md` Section 3 and Section 9. Claude, or any coding agent, may research an architectural question and recommend a decision, but may not resolve an unresolved architectural decision unilaterally — an ADR here is only `Accepted` once the owner has approved it.

## Index

| ADR                                                       | Title                                     | Status                  |
| --------------------------------------------------------- | ----------------------------------------- | ----------------------- |
| [000](./000-template.md)                                  | Template                                  | — (not a real decision) |
| [001](./001-product-philosophy.md)                        | Product Philosophy                        | Accepted                |
| [002](./002-organization-and-institution-hierarchy.md)    | Organization and Institution Hierarchy    | Accepted                |
| [003](./003-plugin-platform.md)                           | Plugin Platform                           | Accepted                |
| [004](./004-ai-assistance-and-user-control.md)            | AI Assistance and User Control            | Accepted                |
| [005](./005-vendor-abstraction-and-integration-engine.md) | Vendor Abstraction and Integration Engine | Accepted                |
| [006](./006-monorepo-architecture.md)                     | Monorepo Architecture                     | Accepted                |
| [007](./007-domain-driven-architecture.md)                | Domain Driven Architecture                | Accepted                |
| [008](./008-authorization-model.md)                       | Authorization Model                       | Accepted                |

## Status Values

- **Proposed** — drafted, not yet approved. Non-binding.
- **Accepted** — approved by the owner. Binding until superseded, deprecated, or rejected.
- **Superseded** — replaced by a later ADR, which is linked from this one. The superseded ADR remains for historical context.
- **Deprecated** — no longer the platform's direction, but not replaced by a specific successor ADR.
- **Rejected** — considered and explicitly not adopted. Kept so the same alternative isn't re-litigated without new information.

## Numbering

ADRs in this directory are numbered `NNN-kebab-case-title.md`, sequential, never reused. Start a new ADR from [`000-template.md`](./000-template.md).

## Consolidation History

An earlier, differently-numbered set of ADRs previously lived at `docs/decisions/` (`ADR-0001-monorepo.md`, `ADR-0002-domain-driven.md`, `ADR-0003-authorization-model.md`, dated 2026-07-09, predating this directory). As part of Milestone 1's final documentation cleanup, these three were **consolidated into this directory** as ADR-006, ADR-007, and ADR-008 respectively — content preserved in full (reformatted to this directory's template), original decision dates preserved, and (for ADR-007/008) a stale `Proposed` status label corrected to `Accepted` to match how those decisions were already treated everywhere else in the repository. See each migrated ADR's own "Migration note" for details.

`docs/decisions/` still exists, but only as short redirect stubs pointing here (plus its own `README.md` explaining the move) — it is not a second source of truth and nothing new is added there. No ADR content is duplicated between the two directories.

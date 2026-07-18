# ADR-003 — Plugin Platform

**Status:** Accepted
**Date:** 2026-07-19

---

## Context

`ARCHITECTURE.md` already establishes that business modules must remain independent and communicate only through approved interfaces. Milestone 1 extends this idea one step further: Nera should be designed, from the start, so that a future extension (internal or external) could connect to the platform through stable contracts, without the platform needing to be re-architected to allow it — even though no such extension exists yet and none is being built now. This ADR formalizes that intent so it is a binding design constraint on every engine built from Milestone 2 onward, not an aspiration mentioned once and then forgotten.

## Decision

1. **Nera is designed as an extensible plugin platform**, even though it ships today, and through V1, as a modular monolith with no running plugin runtime.
2. **Extensions connect through stable, versioned contracts** owned by the relevant Core Engine — not by reaching into engine or module internals. Where authorized, an extension may extend: navigation, UI surfaces, permissions, entity types, workflows, search, reports, forms, business events, document handlers, and integrations.
3. **Extensions may never bypass authentication, authorization, tenant isolation, Row Level Security, validation, or audit.** No extension point is exempt from this, regardless of how it is described or how limited its apparent scope.
4. **No marketplace and no untrusted/dynamic third-party code execution is implemented now.** Until a Plugin/Extension Runtime exists as a running system, "extension points" are a design discipline applied while building each engine's own public contract — not a separate product.

## Consequences

- Every Core Engine's public contract (see `ENGINE_MAP.md`) is designed as if a plugin might sit behind the consuming side of it, even in Milestone 2/3 when the only real consumer is Nera's own business modules. This adds a small amount of design discipline now (stable, explicit contracts instead of ad hoc internal calls) in exchange for not having to redesign those contracts later to support a real plugin.
- No engine may implement an extension point as a direct code-level override of engine internals (e.g. monkey-patching, reflection-based hooks) — only explicit registration contracts (e.g. "register a report definition") count as a supported extension mechanism.
- Building an actual Plugin/Extension Runtime, sandboxing, or a marketplace remains explicitly out of scope until a future ADR revisits this decision with a real, justified need.

## Alternatives Considered

- **Design nothing for extensibility now, revisit if/when a real plugin is needed** — rejected. Retrofitting stable contracts onto engines already built without them is the kind of expensive rework `NERA_CONSTITUTION.md`'s "Simplicity Wins" and "Backward Compatibility" principles are meant to prevent; a small amount of contract discipline now is cheaper than a breaking redesign later.
- **Build a full plugin runtime and marketplace now** — rejected as overengineering ahead of a real, justified need, per `NERA_CONSTITUTION.md` Section 12. There is no plugin today; building the runtime for one is premature.

## Follow-up Actions

- `NERA_CONSTITUTION.md` Section 10 and `ENGINE_MAP.md`'s Plugin / Extension Runtime entry restate this decision; keep both in sync with this ADR if it changes.
- Every engine built in Milestone 2 and Milestone 3 documents its extension points in `ENGINE_MAP.md` as part of that engine's own delivery, per the pattern already established there.
- A future ADR is required before: building a running Plugin/Extension Runtime, allowing dynamic/untrusted code execution, or opening any form of marketplace.

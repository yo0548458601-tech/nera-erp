# ADR-005 — Vendor Abstraction and Integration Engine

**Status:** Accepted
**Date:** 2026-07-19

---

## Context

Nera depends, and will keep depending, on external providers: a database, an authentication provider, file storage, a banking/MASAV exchange path, and — eventually — email, messaging, and AI providers. `TECH_STACK.md` already establishes this principle narrowly for AI ("business modules never communicate directly with AI providers"). Milestone 1 generalizes it to every external provider, and introduces the Integration Engine as the owner of external-system adapters, since no engine in the original `ARCHITECTURE.md` list had that responsibility. This ADR does **not** select or change any specific provider — see ADR foundation note below and `ROADMAP.md` Section 9: the current stack (Prisma, and whatever authentication/storage mechanism is actually implemented in the repository today) remains the source of truth until a dedicated future ADR formally decides otherwise.

## Decision

1. **External providers are accessed only through the owning platform engine.** A database is accessed through the data-access layer a Core Engine owns; an auth provider is accessed only through the Identity/Authentication Engine; storage only through the Document Engine; banking/MASAV, email, messaging, and future external APIs only through the Integration Engine.
2. **Business modules and UI code must never call a vendor SDK directly.** If a module needs an external capability, it calls the owning engine's contract, not the vendor's client library.
3. **The Integration Engine owns provider adapters and external-system communication**, including (as they are built): banking and MASAV exchange, email, messaging, document ingestion, external APIs, and future AI provider communication (the last in coordination with the AI Assistance Engine, per ADR-004).
4. **Providers must be replaceable without rewriting business modules.** Because modules only ever call an engine's contract, swapping what sits behind that contract (a different auth provider, a different storage backend, a different bank-file transport) is an engine-internal change, not a platform-wide rewrite.
5. This ADR is provider-neutral by design. It does not select, confirm, or rule out any specific vendor (database, auth, storage, or otherwise) — that remains a separate, future decision, made by its own ADR once the stack differences already flagged in `ROADMAP.md` Section 9 are formally resolved.

## Consequences

- Every engine that wraps an external provider (Identity/Authentication, Document, Integration, and eventually AI Assistance) is responsible for its own vendor-facing adapter layer; this is now a documented, binding design requirement, not an implementation detail left to whoever builds it.
- A future provider migration (for any of the above) is scoped to the owning engine's internals plus its own migration ADR — it does not, by this ADR's design, require touching `modules/*` code, provided the engine's public contract does not change.
- The Integration Engine is now a formally approved platform engine (see `ENGINE_MAP.md`), even though `ARCHITECTURE.md`'s original engine list did not include it — that original list should be amended in a future documentation pass to stay consistent with this ADR.
- This ADR does not, by itself, authorize any migration away from the currently implemented stack. See `ROADMAP.md` Section 9 for what remains genuinely unresolved.

## Alternatives Considered

- **Let modules call vendor SDKs directly where convenient** — rejected. This is precisely the pattern that made the AI-provider rule in `TECH_STACK.md` necessary in the first place; generalizing the rule is simpler than re-deriving it per provider, per module, over time.
- **Fold external-system communication into whichever engine happens to need it first** (e.g. let the Payments module own MASAV file exchange directly) — rejected. It would duplicate adapter logic the next integration (email ingestion for AI Assistance, a future accounting-system sync) would need again, contradicting `NERA_CONSTITUTION.md`'s "No Business Logic Duplication" and "Platform First" principles.

## Follow-up Actions

- `NERA_CONSTITUTION.md` Section 3.7 (Vendor Abstraction) and `ENGINE_MAP.md`'s Integration Engine entry restate this decision; keep both in sync with this ADR if it changes.
- Recommend a future documentation pass to add "Integration Engine" to `ARCHITECTURE.md` Section 5's approved engine list, so the legacy document stays consistent with this ADR.
- The actual provider decision (Prisma vs. an alternative; the auth/storage provider) remains open and is explicitly not decided by this ADR — see `ROADMAP.md` Section 9 and the P008 sprint definition.

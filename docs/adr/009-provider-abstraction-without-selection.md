# ADR-009 — Provider Abstraction Without Provider Selection

**Status:** Accepted
**Date:** 2026-07-19

---

## Context

`ROADMAP.md` §9.2 left exactly one item for P008 to resolve: the database/auth/storage provider stack. Per the owner's Milestone 1 decision, no provider (Supabase, Drizzle, Better Auth, MinIO, or otherwise) may be described as selected unless it is already implemented and confirmed in the repository. Today, only Prisma (data layer, `packages/database`) is actually implemented; there is no real authentication provider (`demoAuth.ts` is an explicit demo stub, not a provider) and no storage provider of any kind.

P008's brief is platform architecture, not provider selection: build the infrastructure that lets a provider be plugged in later, without picking one now. The owner additionally directed, mid-sprint, that **no package's dependencies are modified in P008** — which rules out even the lowest-risk possible provider wiring (binding the already-implemented Prisma client behind a new contract), since that would add a dependency edge from `packages/database` to the new platform-core package.

## Decision

1. P008 defines three provider contracts — `DatabaseProvider`, `AuthProvider`, `StorageProvider` — as TypeScript interfaces in the new `@nera/core` package (see ADR-010), describing the shape any future implementation must satisfy.
2. P008 also defines the generic registration/resolution mechanism (`registerProvider` / `getProvider`) those contracts are used through, per the Vendor Abstraction principle (`NERA_CONSTITUTION.md` §3.7, ADR-005).
3. **No concrete provider is selected, installed, or bound for any of the three** — not database, not auth, not storage. This includes Prisma: even though it is already implemented and working, P008 does not formally bind it behind `DatabaseProvider`, because doing so would modify `packages/database`'s dependencies, which is explicitly out of scope for this sprint.
4. `demoAuth.ts` is left completely untouched. No authentication library (Better Auth or otherwise) is installed. No storage library is installed.
5. Any provider-specific decision — which vendor, and wiring a concrete implementation behind these contracts — is deferred to a future sprint and its own ADR, once there is a real, justified need (e.g. Milestone 3 needing real multi-user authentication).

## Consequences

- The contracts exist and are tested (structurally, against fakes — see ADR-010) but have zero real-world binding today. A future sprint that picks a provider does so as a pure additive change: implement the interface, register it, done — no rewrite of the contract or of any code that will eventually depend on it, because nothing depends on it yet.
- `packages/database` is unchanged by this ADR — same dependencies, same exports, same behavior.
- This ADR resolves `ROADMAP.md` §9.2's item only partially by design: it settles _how_ a provider will eventually be plugged in, not _which_ provider. The "which" question remains genuinely open and is not silently decided by omission.

## Alternatives Considered

- **Confirm Prisma as the selected `DatabaseProvider` and wire it now** — rejected. This was the original plan (see the P008 plan file), but the owner's mid-sprint "do not modify package dependencies" instruction directly rules it out: wiring Prisma behind the contract requires `packages/database` to depend on `@nera/core`, which is a dependency change.
- **Pick a real auth vendor now, matching `.env.example`'s `BETTER_AUTH_*` placeholders** — rejected. Those placeholders are directional hints, not an implemented, confirmed decision per the owner's Milestone 1 rule; picking one now would be exactly the kind of unresolved architectural decision `NERA_CONSTITUTION.md` §9.8 forbids an agent from resolving unilaterally, and the owner explicitly chose the "contracts only" option when asked.
- **Skip provider contracts entirely until a vendor is chosen** — rejected. `PRODUCT_VISION.md`'s and `ADR-004`'s "design for later without building now" pattern (already used for the AI Assistance suggestion shape) applies equally well here: the contract can be designed now, cheaply, so that whichever provider is chosen later doesn't force a redesign of every engine that will eventually depend on it.

## Follow-up Actions

- A future ADR is required before any concrete provider (Prisma-as-`DatabaseProvider`, any `AuthProvider`, any `StorageProvider`) is bound — this ADR does not pre-approve that; it only approves the contract shape.
- When that future ADR is written, it should reference this one and `ADR-010`'s `ProviderRegistry` mechanism rather than re-deriving the registration pattern.
- `ROADMAP.md` §9.2 should be updated to reflect that the _mechanism_ is now resolved, while the _vendor_ remains the one genuinely open item.

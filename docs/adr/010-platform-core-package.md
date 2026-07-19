# ADR-010 — Platform Core Package: Engine Registry, Contracts, and Plugin Runtime Foundations

**Status:** Accepted
**Date:** 2026-07-19

---

## Context

`ROADMAP.md` §9.1.2 (Milestone 1) pre-authorized a future `packages/core` package on one condition: it may be added "only once it has a clearly defined responsibility not already owned elsewhere... and only via its own ADR when that need is real." P008's brief is to build exactly that kind of responsibility: an Engine Registry, formal Engine Contracts, a Plugin Runtime skeleton, and dependency-boundary enforcement — none of which is owned by `packages/types` (one trivial type today) or by any individual engine package (each owns its own domain, not cross-engine infrastructure). This ADR is that condition being satisfied.

Investigation of the 5 existing engine packages (`entity`, `authorization`, `customization`, `settings`, `calendar`) found none of them has a class, factory, instance, or lifecycle — every one is a stateless library of types and pure functions. Any registry/contract design has to describe **metadata and public API shape**, not invent an instantiation model the codebase doesn't have. Investigation also found zero dependency-boundary tooling anywhere in the repo (no `eslint-plugin-boundaries`, no `dependency-cruiser`), and zero CI to run one in.

`ADR-003` (Plugin Platform) already establishes that Nera is designed as an extensible platform but explicitly forbids "a separate running system" — dynamic/untrusted code execution or a marketplace — in V1 or Milestone 1. P008 is Milestone 2. A registration-only skeleton for trusted, internal registrations against a fixed, known set of extension points is exactly what ADR-003 calls "the supported extension mechanism," not what it forbids.

## Decision

1. **Introduce `packages/core` (`@nera/core`)** as a new workspace package, following the `packages/types` template exactly: `main`/`types` → `src/index.ts`, no `exports` field, tsconfig extending `packages/config/tsconfig/base.json`, zero declared dependencies.
2. **Engine Registry & Contracts** (`src/engine.ts`): an `EngineDescriptor` type — id, responsibility, boundaries, owned data, dependencies (typed as other engine ids, not free text), consumers, events emitted/consumed, security requirements, audit requirements, extension points, and status (`existing` / `partial` / `planned`, reusing `ENGINE_MAP.md`'s own vocabulary) — and a populated `engineRegistry` with one entry per engine already documented in `ENGINE_MAP.md`, transcribed from that document so there is one source of truth, not two independently-maintained ones. Query helpers (`getEngine`, `listEngines`, `getEnginesByStatus`) and a cycle-detection check (`assertNoDependencyCycles`) make the registry a live, testable artifact, not just a data dump.
3. **Provider abstraction** (`src/provider.ts`): `DatabaseProvider`, `AuthProvider`, `StorageProvider` interfaces plus a generic `ProviderRegistry` (register/resolve by kind). Per ADR-009, no concrete provider is bound to any of them in this sprint.
4. **Plugin Runtime skeleton** (`src/plugin.ts`): an `ExtensionPointId` union matching `NERA_CONSTITUTION.md` §10's extension-point list exactly (navigation, UI surfaces, permissions, entity types, workflows, search, reports, forms, business events, document handlers, integrations), an `ExtensionRegistration` type, and a `PluginRegistry` that only accepts registrations against a known `ExtensionPointId` — an unlisted point is a type error, not a runtime check that could be skipped. No dynamic loading, no sandboxing, no marketplace.
5. **Dependency-boundary enforcement** (`src/dependencyRules.ts`): the Constitution's layer graph (`Platform → Core Engines → Business Modules → Apps`, `NERA_CONSTITUTION.md` §3.9) expressed as data, plus `validateWorkspaceDependencies()`, which reads every real `package.json` in the workspace via `node:fs` (a Node built-in, no new dependency) and asserts no package declares a dependency on a package in a higher layer than itself. This is exercised by an ordinary Vitest test that runs against the live repository today, via the already-configured `npm test` — not a new tool, not a new script, not new CI.
6. Every file above ships with tests, following the existing pattern in `packages/engines/calendar/src/index.test.ts` (the one package in the repo with real test coverage before this sprint).

## Consequences

- `@nera/core` sits at the Platform layer, one level _below_ the 16 Core Engines it catalogs — it is infrastructure Core Engines may depend on, not itself a 17th Core Engine. `ENGINE_MAP.md` gains a short appendix (parallel to its existing Calendar appendix) documenting this relationship, and its Plugin / Extension Runtime entry (§14) status changes from `planned` to `partial`, since a real registration skeleton now exists — though still with no dynamic execution or marketplace.
- Nothing outside `packages/core` changes. No existing package's `package.json`, source, or exports are touched. `@nera/core` has zero consumers today — it exists, is tested in isolation, and is ready for the next sprint that actually needs it (e.g. wiring a provider, or the first business module registering a workflow definition).
- The Engine Registry's data (descriptions, dependencies, statuses) must be kept in sync with `ENGINE_MAP.md` by hand for now — this ADR does not introduce doc generation from code or vice versa. A future sprint could automate that; not justified yet for a registry with zero real consumers.

## Alternatives Considered

- **Force existing engines into a class/instance shape to "properly" implement contracts** — rejected. None of the 5 existing engines has that shape today, and retrofitting one for the sake of a registry would be exactly the kind of engine-code change P008's brief excludes ("no business functionality," and no work on the 5 existing engines was requested).
- **Use a third-party dependency-boundary tool (`dependency-cruiser`, `eslint-plugin-boundaries`)** — rejected for this sprint. Both would add a new dependency, and the repo's actual layering violations today are checkable via each package's own declared `dependencies` (there are currently _zero_ cross-package runtime dependencies among the 5 engines) without needing a source-level import-graph tool. `NERA_CONSTITUTION.md`'s "Simplicity Wins" favors the zero-dependency Vitest-based check for now; a stronger tool remains available later if package-level checking proves insufficient once `modules/*` starts being built.
- **Build a real Plugin Runtime (dynamic loading, sandboxing)** — rejected. `ADR-003` explicitly requires a future ADR with "a real, justified need" before that; no such need exists yet with zero modules and zero plugins.
- **Split contracts, registry, and plugin skeleton into three separate packages** — rejected as premature subdivision. They are small, tightly related, and always used together; `packages/entities` (17 files, one package) is the existing precedent for keeping a cohesive domain in one package rather than many.

## Follow-up Actions

- The next sprint that needs a provider (see ADR-009's follow-up) implements `DatabaseProvider`/`AuthProvider`/`StorageProvider` against `@nera/core`'s interfaces and registers it via `ProviderRegistry` — no redesign of the contract expected.
- The first real business module (Suppliers, P016) is the first real consumer of the dependency-boundary rules in anger — `dependencyRules.test.ts` should catch it immediately if that module's `package.json` ever declares a dependency in the wrong direction.
- `docs/ENGINE_MAP.md` and `docs/ROADMAP.md` are updated alongside this ADR, per `NERA_CONSTITUTION.md` §9.6.

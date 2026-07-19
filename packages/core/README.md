# @nera/core

Platform-layer infrastructure for the Nera platform, introduced in P008. See ADR-010 for the full decision record.

This package sits **below** the Core Engines it catalogs, not among them - it is what Core Engines and business modules may depend on, not itself an engine with a `docs/ENGINE_MAP.md` entry of its own.

## What's here

- **`engine.ts`** - the Engine Registry: `EngineDescriptor`, the `engineRegistry` catalog (one entry per engine in `docs/ENGINE_MAP.md`), and query/validation helpers.
- **`provider.ts`** - the `DatabaseProvider` / `AuthProvider` / `StorageProvider` contracts and a minimal register/resolve mechanism. No concrete provider is selected or bound here - see ADR-009.
- **`plugin.ts`** - the Plugin Runtime skeleton: a closed `ExtensionPointId` union matching `NERA_CONSTITUTION.md` Section 10, and a registration-only `PluginRegistry`. No dynamic loading, no sandboxing, no marketplace - see ADR-003.
- **`dependencyRules.ts`** - reads the real workspace's `package.json` files and validates the Constitution's layer graph (`Platform → Core Engines → Business Modules → Apps`). Exercised by `dependencyRules.test.ts` against the live repository on every `npm test` run.

## What's not here

No concrete provider implementation, no wiring into any existing package or app, no schema changes, no UI. This package has zero consumers today - it exists, is tested in isolation, and is ready for the next sprint that needs it.

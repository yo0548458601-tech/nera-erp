/**
 * Provider abstraction contracts (ADR-009, ADR-005 "Vendor Abstraction").
 *
 * These are pure TypeScript interfaces plus a minimal registration
 * mechanism. No concrete provider is selected or bound here, or anywhere in
 * this package - not database, not auth, not storage. Business modules and
 * UI code must never call a vendor SDK directly; they call through the
 * engine that owns the relevant provider (Identity/Authentication,
 * Document, Integration), which resolves it through this registry.
 *
 * A real implementation of any of these interfaces, and the decision of
 * which vendor to use, is deliberately out of scope for this sprint - see
 * ADR-009's Follow-up Actions.
 */

/** The minimal identity a session carries - matches the Organization/Institution model from ADR-002. */
export type ProviderSession = {
  userId: string;
  organizationId: string;
  /** Optional: only present if the organization uses institutions, and always validated against organizationId by the caller (ADR-002). */
  institutionId?: string;
  issuedAt: string;
  expiresAt: string;
};

export interface AuthProvider {
  getSession(token: string): Promise<ProviderSession | null>;
  createSession(userId: string, organizationId: string): Promise<ProviderSession>;
  invalidateSession(token: string): Promise<void>;
}

/**
 * Deliberately narrow. An earlier draft of this contract included a generic
 * `query(statement, params)` method - rejected during P008 review, because
 * it would force every future caller through raw SQL strings, discarding
 * the typed model access that is the entire reason Prisma was confirmed as
 * the data layer (ADR-009). A vendor-neutral interface cannot describe a
 * typed query API without knowing the vendor's query shape - Prisma's
 * generated client, Drizzle's query builder, and raw SQL are not
 * interchangeable at that level of detail, and pretending otherwise is what
 * produced the raw-SQL fallback in the first place.
 *
 * So this contract governs connection lifecycle and transaction
 * *boundaries* only - concerns that genuinely are vendor-agnostic. Actual
 * data access goes through whatever typed client the concrete, engine-owned
 * package exposes (e.g. `@nera/database`'s Prisma client, imported directly
 * by the engine that needs it - see `dependencyRules.ts`'s vendor-ownership
 * check). `DatabaseProvider` exists only for the questions above that typed
 * client: is the underlying database reachable, and can a unit of work be
 * wrapped in a single transaction, without the caller needing to know or
 * care which vendor answers them.
 */
export interface DatabaseProvider {
  isConnected(): Promise<boolean>;
  disconnect(): Promise<void>;
  /**
   * Runs `run` within a single transactional unit of work; the provider
   * decides what "transactional" means for its vendor. Callers that need
   * transaction-scoped *data access* do so through their own typed client
   * (e.g. Prisma's own `$transaction`), not through this generic contract -
   * `run` takes no arguments and its return value is opaque to this
   * interface on purpose.
   */
  runInTransaction<TResult>(run: () => Promise<TResult>): Promise<TResult>;
}

/**
 * Amended by ADR-011 (Storage Provider Selection, Decision item 17), a real,
 * intentional, source-breaking contract change - not additive:
 * - `upload`'s third parameter changes from a bare `contentType` string to a
 *   required options object, because `Content-Disposition` (set once, at
 *   upload time, from a server-sanitized filename - ADR-011 item 14/15)
 *   cannot be expressed through the original signature.
 * - `upload`'s return type drops `url`. Under the accepted private-bucket,
 *   signed-URL-only access model, a URL returned directly by `upload()` has
 *   no safe or defined meaning (ADR-011 item 16) - a usable download URL is
 *   only ever produced by `getSignedUrl()`, per request, after the Document
 *   Engine's full authorization gate. No object URL is ever persisted.
 */
export interface StorageProvider {
  upload(
    key: string,
    content: Uint8Array,
    options: { contentType: string; contentDisposition?: string }
  ): Promise<{ key: string }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export type ProviderMap = {
  database: DatabaseProvider;
  auth: AuthProvider;
  storage: StorageProvider;
};

export type ProviderKind = keyof ProviderMap;

export type ProviderRegistryHandle = {
  /**
   * Throws if a provider is already registered for `kind`. Silently
   * replacing a registered provider was considered and rejected during P008
   * review: providers are more sensitive than most registrations (an
   * accidentally-overwritten `AuthProvider` mid-runtime is a correctness/
   * security hazard, not just a UX quirk), so a duplicate registration is
   * treated as a programming error to fix at the call site, not a valid
   * "replace" operation - matches `PluginRegistry.registerExtension`'s
   * duplicate-id behavior in `plugin.ts`.
   */
  registerProvider<TKind extends ProviderKind>(kind: TKind, provider: ProviderMap[TKind]): void;
  /** Returns `undefined` if nothing is registered for `kind` - callers that treat a missing provider as a startup-time configuration error should check `hasProvider` (or the `undefined` result) explicitly rather than assume one is always present. */
  getProvider<TKind extends ProviderKind>(kind: TKind): ProviderMap[TKind] | undefined;
  hasProvider(kind: ProviderKind): boolean;
};

/**
 * Factory, not a class or singleton - matches the rest of the codebase's
 * stateless-function convention (see `packages/engines/*`). Each call
 * returns an independent registry so tests never leak state into each
 * other; the platform's real registry (wired up in a later sprint, once a
 * provider actually exists to register) is one call to this held in module
 * scope by whichever engine owns that lifecycle.
 */
export function createProviderRegistry(): ProviderRegistryHandle {
  const providers = new Map<ProviderKind, ProviderMap[ProviderKind]>();

  return {
    registerProvider(kind, provider) {
      if (providers.has(kind)) {
        throw new Error(
          `A provider is already registered for "${kind}". Duplicate registration is not allowed.`
        );
      }
      providers.set(kind, provider);
    },
    getProvider(kind) {
      return providers.get(kind) as ProviderMap[typeof kind] | undefined;
    },
    hasProvider(kind) {
      return providers.has(kind);
    },
  };
}

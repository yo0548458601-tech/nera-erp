/**
 * Plugin Runtime skeleton (ADR-003, ADR-010).
 *
 * This is a registration-only mechanism for trusted, internal code (a
 * future business module, or another engine) to declare that it extends a
 * known platform surface. It is deliberately NOT a running plugin system:
 * there is no dynamic loading, no sandboxing, and no marketplace - ADR-003
 * forbids all three without its own future ADR. A registration here is
 * inert data until whatever owns the relevant surface (the Reporting
 * Engine for a report registration, the nav config for a navigation
 * registration, etc.) chooses to read and act on it - and that consumer is
 * responsible for applying its own authentication, authorization, tenant,
 * RLS, audit and validation checks when it does. This registry does not,
 * and cannot yet, enforce that on its own behalf, because nothing here
 * executes anything.
 */

/**
 * Exactly the extension-point list in `NERA_CONSTITUTION.md` Section 10 -
 * no more, no less. Because this is a closed union, registering against an
 * unlisted point is a compile-time type error, not a runtime check that
 * could be forgotten or bypassed.
 */
export type ExtensionPointId =
  | 'navigation'
  | 'ui-surfaces'
  | 'permissions'
  | 'entity-types'
  | 'workflows'
  | 'search'
  | 'reports'
  | 'forms'
  | 'business-events'
  | 'document-handlers'
  | 'integrations';

export type ExtensionRegistration = {
  /** Unique across the whole registry, e.g. "suppliers.navigation.main-link". */
  id: string;
  extensionPoint: ExtensionPointId;
  /** The module or engine that owns this registration, e.g. "suppliers" or "@nera/core". */
  registeredBy: string;
  description: string;
};

export type PluginRegistryHandle = {
  registerExtension(registration: ExtensionRegistration): void;
  listExtensions(): ExtensionRegistration[];
  getExtensionsFor(extensionPoint: ExtensionPointId): ExtensionRegistration[];
};

/**
 * Factory, not a class or singleton - same convention as `createProviderRegistry`
 * in provider.ts, and the same reasoning: independent instances keep tests
 * isolated, and the platform's real registry is one call to this held by
 * whichever engine ends up owning that lifecycle in a later sprint.
 */
export function createPluginRegistry(): PluginRegistryHandle {
  const registrations: ExtensionRegistration[] = [];

  return {
    registerExtension(registration) {
      if (registrations.some(existing => existing.id === registration.id)) {
        throw new Error(`Extension "${registration.id}" is already registered.`);
      }
      registrations.push(registration);
    },
    listExtensions() {
      return [...registrations];
    },
    getExtensionsFor(extensionPoint) {
      return registrations.filter(registration => registration.extensionPoint === extensionPoint);
    },
  };
}

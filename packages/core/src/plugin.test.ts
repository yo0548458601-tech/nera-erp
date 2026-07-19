import { describe, expect, it } from 'vitest';
import { createPluginRegistry, type ExtensionRegistration } from './plugin';

describe('createPluginRegistry', () => {
  it('starts empty', () => {
    const registry = createPluginRegistry();
    expect(registry.listExtensions()).toEqual([]);
  });

  it('registers an extension and lists it back', () => {
    const registry = createPluginRegistry();
    const registration: ExtensionRegistration = {
      id: 'suppliers.navigation.main-link',
      extensionPoint: 'navigation',
      registeredBy: 'suppliers',
      description: 'Adds the Suppliers section to the main navigation.',
    };

    registry.registerExtension(registration);

    expect(registry.listExtensions()).toEqual([registration]);
  });

  it('filters extensions by extension point', () => {
    const registry = createPluginRegistry();
    registry.registerExtension({
      id: 'suppliers.navigation.main-link',
      extensionPoint: 'navigation',
      registeredBy: 'suppliers',
      description: 'Nav entry.',
    });
    registry.registerExtension({
      id: 'suppliers.reports.spend-summary',
      extensionPoint: 'reports',
      registeredBy: 'suppliers',
      description: 'Supplier spend summary report.',
    });

    expect(registry.getExtensionsFor('navigation')).toHaveLength(1);
    expect(registry.getExtensionsFor('reports')).toHaveLength(1);
    expect(registry.getExtensionsFor('forms')).toHaveLength(0);
  });

  it('rejects a second registration with the same id', () => {
    const registry = createPluginRegistry();
    const registration: ExtensionRegistration = {
      id: 'suppliers.navigation.main-link',
      extensionPoint: 'navigation',
      registeredBy: 'suppliers',
      description: 'Nav entry.',
    };

    registry.registerExtension(registration);

    expect(() => registry.registerExtension(registration)).toThrow(/already registered/);
  });

  it('keeps registries independent per instance', () => {
    const registryA = createPluginRegistry();
    const registryB = createPluginRegistry();

    registryA.registerExtension({
      id: 'a.navigation.link',
      extensionPoint: 'navigation',
      registeredBy: 'a',
      description: 'A link.',
    });

    expect(registryA.listExtensions()).toHaveLength(1);
    expect(registryB.listExtensions()).toHaveLength(0);
  });
});

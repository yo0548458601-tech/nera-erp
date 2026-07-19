import { describe, expect, it } from 'vitest';
import {
  discoverWorkspacePackages,
  findDependencyViolations,
  findVendorSdkViolations,
  validateWorkspaceDependencies,
  type WorkspacePackageInfo,
} from './dependencyRules';

function pkg(overrides: Partial<WorkspacePackageInfo>): WorkspacePackageInfo {
  return {
    name: '@nera/fixture',
    relativePath: 'packages/fixture',
    layer: 'platform',
    dependencyNames: [],
    ...overrides,
  };
}

describe('findDependencyViolations (synthetic fixtures)', () => {
  it('allows a higher layer depending on a lower layer', () => {
    const platform = pkg({ name: '@nera/core', layer: 'platform' });
    const coreEngine = pkg({
      name: '@nera/entity-engine',
      layer: 'core-engine',
      dependencyNames: ['@nera/core'],
    });

    expect(findDependencyViolations([platform, coreEngine])).toEqual([]);
  });

  it('flags a platform package depending on a core-engine package', () => {
    const platform = pkg({
      name: '@nera/core',
      layer: 'platform',
      dependencyNames: ['@nera/entity-engine'],
    });
    const coreEngine = pkg({ name: '@nera/entity-engine', layer: 'core-engine' });

    const violations = findDependencyViolations([platform, coreEngine]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      packageName: '@nera/core',
      dependsOnName: '@nera/entity-engine',
    });
  });

  it('flags a core-engine package depending on a business-module package', () => {
    const coreEngine = pkg({
      name: '@nera/entity-engine',
      layer: 'core-engine',
      dependencyNames: ['@nera/suppliers'],
    });
    const businessModule = pkg({ name: '@nera/suppliers', layer: 'business-module' });

    const violations = findDependencyViolations([coreEngine, businessModule]);
    expect(violations).toHaveLength(1);
  });

  it('flags one business module depending on another, even though they share a layer', () => {
    const suppliers = pkg({
      name: '@nera/suppliers',
      layer: 'business-module',
      dependencyNames: ['@nera/purchase-orders'],
    });
    const purchaseOrders = pkg({ name: '@nera/purchase-orders', layer: 'business-module' });

    const violations = findDependencyViolations([suppliers, purchaseOrders]);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/must not depend on another business module/);
  });

  it('allows an app package to depend on anything', () => {
    const app = pkg({
      name: 'web',
      layer: 'app',
      dependencyNames: ['@nera/core', '@nera/entity-engine'],
    });
    const platform = pkg({ name: '@nera/core', layer: 'platform' });
    const coreEngine = pkg({ name: '@nera/entity-engine', layer: 'core-engine' });

    expect(findDependencyViolations([app, platform, coreEngine])).toEqual([]);
  });

  it('ignores non-@nera dependencies and dependencies not found in the workspace', () => {
    const platform = pkg({
      name: '@nera/core',
      layer: 'platform',
      dependencyNames: ['typescript', '@nera/does-not-exist-in-this-scan'],
    });

    expect(findDependencyViolations([platform])).toEqual([]);
  });
});

describe('findVendorSdkViolations (synthetic fixtures)', () => {
  it('flags an unauthorized package depending directly on a known vendor SDK', () => {
    const unauthorized = pkg({
      name: '@nera/entity-engine',
      layer: 'core-engine',
      dependencyNames: ['@prisma/client'],
    });

    const violations = findVendorSdkViolations([unauthorized]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      kind: 'vendor-sdk-bypass',
      packageName: '@nera/entity-engine',
      dependsOnName: '@prisma/client',
    });
    expect(violations[0].reason).toMatch(/vendor SDK owned by/);
  });

  it('allows the designated owner to depend on the vendor SDK it owns', () => {
    const owner = pkg({
      name: '@nera/database',
      layer: 'platform',
      dependencyNames: ['@prisma/client', 'prisma'],
    });

    expect(findVendorSdkViolations([owner])).toEqual([]);
  });

  it('ignores dependencies that are not in the vendor SDK ownership map', () => {
    const anyPackage = pkg({
      name: '@nera/entity-engine',
      layer: 'core-engine',
      dependencyNames: ['react', 'typescript', 'lucide-react'],
    });

    expect(findVendorSdkViolations([anyPackage])).toEqual([]);
  });
});

describe('validateWorkspaceDependencies (real repository)', () => {
  it('discovers the known existing workspace packages', () => {
    const packages = discoverWorkspacePackages();
    const names = packages.map(p => p.name);

    // Sanity check that the scan actually found real packages before trusting
    // "zero violations" below - an empty scan would trivially report zero
    // violations without proving anything.
    expect(names).toContain('@nera/entity-engine');
    expect(names).toContain('@nera/authorization-engine');
    expect(names).toContain('@nera/database');
    expect(names).toContain('web');
    expect(names).toContain('@nera/core');
  });

  it('has zero dependency-boundary violations in the current repository', () => {
    expect(validateWorkspaceDependencies()).toEqual([]);
  });

  it('only @nera/database depends on the known vendor SDKs (@prisma/client, prisma) today', () => {
    const packages = discoverWorkspacePackages();
    const dependents = packages.filter(
      p => p.dependencyNames.includes('@prisma/client') || p.dependencyNames.includes('prisma')
    );

    expect(dependents.map(p => p.name)).toEqual(['@nera/database']);
    expect(findVendorSdkViolations(packages)).toEqual([]);
  });
});

/**
 * Dependency-boundary enforcement (ADR-010; `NERA_CONSTITUTION.md` Section 3.9
 * and Section 12's forbidden-patterns list).
 *
 * Reads the real workspace's `package.json` files via `node:fs` - no new
 * dependency, no new tool - and checks each package's declared dependencies
 * (npm `dependencies` + `devDependencies`) two ways:
 *
 * 1. Layer order, for `@nera/*` packages only: against the platform's layer
 *    order (`Platform -> Core Engines -> Business Modules -> Apps`). A
 *    package may depend on anything in its own layer or a lower one; it
 *    must never depend on anything in a higher layer. Business-module
 *    packages carry one further rule: never depend on another business
 *    module, even in the same layer.
 * 2. Vendor SDK ownership, for any dependency (not just `@nera/*`): per the
 *    Vendor Abstraction principle (`NERA_CONSTITUTION.md` Section 3.7,
 *    ADR-005), a small number of known vendor SDKs may only be depended on
 *    by the specific package that owns that vendor relationship. This is a
 *    maintained allowlist, not automatic vendor-SDK detection - see
 *    `VENDOR_SDK_OWNERSHIP`'s own comment for the documented limitation.
 *
 * `dependencyRules.test.ts` runs `validateWorkspaceDependencies()` against
 * the live repository, so both checks are enforced by the existing
 * `npm test`, not just documented.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type LayerId = 'platform' | 'core-engine' | 'business-module' | 'app';

/** Lower rank = lower layer. A package may only depend on an equal-or-lower rank. */
const LAYER_RANK: Record<LayerId, number> = {
  platform: 0,
  'core-engine': 1,
  'business-module': 2,
  app: 3,
};

export type WorkspacePackageInfo = {
  name: string;
  relativePath: string;
  layer: LayerId;
  /** Every declared dependency name (dependencies + devDependencies), unfiltered. */
  dependencyNames: string[];
};

export type DependencyViolation = {
  kind: 'layer-order' | 'business-module-isolation' | 'vendor-sdk-bypass';
  packageName: string;
  packageLayer: LayerId;
  dependsOnName: string;
  /** Undefined for `vendor-sdk-bypass` - a vendor SDK is not a workspace package and has no layer. */
  dependsOnLayer?: LayerId;
  reason: string;
};

type PackageJsonShape = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/**
 * Which top-level workspace directory maps to which platform layer, one
 * directory level deep - matching the root `package.json` workspaces glob
 * (`apps/*`, `packages/*`, `packages/engines/*`, `modules/*`) exactly.
 * `packages/config`'s own sub-packages (`packages/config/eslint`, etc.) are
 * two levels deep and are NOT real npm workspaces per that glob, so they are
 * correctly never visited here - only `packages/config` itself is.
 */
const WORKSPACE_GROUPS: Array<{ relativeDir: string; layer: LayerId }> = [
  { relativeDir: 'packages', layer: 'platform' },
  { relativeDir: 'packages/engines', layer: 'core-engine' },
  { relativeDir: 'modules', layer: 'business-module' },
  { relativeDir: 'apps', layer: 'app' },
];

function readPackageJson(dir: string): PackageJsonShape | undefined {
  const file = join(dir, 'package.json');
  if (!existsSync(file)) {
    return undefined;
  }
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJsonShape;
}

/**
 * Scans the real workspace (one directory level under each group above) and
 * returns every package that has a `package.json` with a `name`. Silently
 * skips directories with no `package.json` (e.g. `packages/engines` itself,
 * which is a container, not a package).
 */
export function discoverWorkspacePackages(
  workspaceRoot: string = process.cwd()
): WorkspacePackageInfo[] {
  const packages: WorkspacePackageInfo[] = [];

  for (const { relativeDir, layer } of WORKSPACE_GROUPS) {
    const groupDir = join(workspaceRoot, relativeDir);
    if (!existsSync(groupDir) || !statSync(groupDir).isDirectory()) {
      continue;
    }

    for (const entry of readdirSync(groupDir)) {
      const entryPath = join(groupDir, entry);
      if (!statSync(entryPath).isDirectory()) {
        continue;
      }

      const pkg = readPackageJson(entryPath);
      if (!pkg?.name) {
        continue;
      }

      packages.push({
        name: pkg.name,
        relativePath: join(relativeDir, entry),
        layer,
        dependencyNames: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }),
      });
    }
  }

  return packages;
}

const NERA_SCOPE = '@nera/';

/**
 * The core rule: a package's `@nera/*` dependencies must never point to a
 * higher layer than the package's own layer. Business-module packages carry
 * one additional rule (`NERA_CONSTITUTION.md` Section 3.3/Section 12): they
 * must never depend on another business module at all, even in the same
 * layer - modules communicate through engines and events, not by importing
 * each other.
 */
export function findDependencyViolations(packages: WorkspacePackageInfo[]): DependencyViolation[] {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  const violations: DependencyViolation[] = [];

  for (const pkg of packages) {
    for (const dependencyName of pkg.dependencyNames) {
      if (!dependencyName.startsWith(NERA_SCOPE)) {
        continue;
      }

      const dependency = byName.get(dependencyName);
      if (!dependency) {
        // Not a workspace package (or not found by this scan) - nothing to check here.
        continue;
      }

      if (
        pkg.layer === 'business-module' &&
        dependency.layer === 'business-module' &&
        dependency.name !== pkg.name
      ) {
        violations.push({
          kind: 'business-module-isolation',
          packageName: pkg.name,
          packageLayer: pkg.layer,
          dependsOnName: dependency.name,
          dependsOnLayer: dependency.layer,
          reason:
            'A business module must not depend on another business module. Communicate through Core Engines or events instead.',
        });
        continue;
      }

      if (LAYER_RANK[dependency.layer] > LAYER_RANK[pkg.layer]) {
        violations.push({
          kind: 'layer-order',
          packageName: pkg.name,
          packageLayer: pkg.layer,
          dependsOnName: dependency.name,
          dependsOnLayer: dependency.layer,
          reason: `A "${pkg.layer}" package must not depend on a "${dependency.layer}" package - dependencies only flow from higher layers to lower ones.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Vendor SDKs known to be owned by a specific package, per the Vendor
 * Abstraction principle (`NERA_CONSTITUTION.md` Section 3.7, ADR-005): only
 * the listed owner(s) may depend on the vendor SDK directly; every other
 * package must go through that package's contract instead.
 *
 * **Documented limitation:** this is a maintained allowlist, not automatic
 * vendor-SDK detection. There is no reliable way to tell "this npm package
 * is a vendor SDK standing in for a Database/Auth/Storage/Integration
 * provider" from "this is an ordinary library" by name alone - `react`,
 * `tailwindcss` and `dayjs` are not vendor SDKs in this sense; `@prisma/client`
 * is. A vendor SDK not listed here (e.g. a future auth or storage SDK, the
 * moment one is installed) is invisible to this check until someone adds it
 * below - that is a real, currently-open gap, not silently claimed to be
 * solved. Add an entry here in the same sprint that introduces any new
 * vendor dependency.
 */
const VENDOR_SDK_OWNERSHIP: Record<string, string[]> = {
  '@prisma/client': ['@nera/database'],
  prisma: ['@nera/database'],
};

/** Checks every workspace package's dependencies against `VENDOR_SDK_OWNERSHIP`. */
export function findVendorSdkViolations(packages: WorkspacePackageInfo[]): DependencyViolation[] {
  const violations: DependencyViolation[] = [];

  for (const pkg of packages) {
    for (const dependencyName of pkg.dependencyNames) {
      const owners = VENDOR_SDK_OWNERSHIP[dependencyName];
      if (!owners || owners.includes(pkg.name)) {
        continue;
      }

      violations.push({
        kind: 'vendor-sdk-bypass',
        packageName: pkg.name,
        packageLayer: pkg.layer,
        dependsOnName: dependencyName,
        reason: `"${dependencyName}" is a vendor SDK owned by ${owners.join(' or ')} (Vendor Abstraction, NERA_CONSTITUTION.md Section 3.7). "${pkg.name}" must go through that package's contract instead of depending on the vendor SDK directly.`,
      });
    }
  }

  return violations;
}

/** Runs the real workspace scan and both violation checks together - the function `dependencyRules.test.ts` calls against the live repo. */
export function validateWorkspaceDependencies(
  workspaceRoot: string = process.cwd()
): DependencyViolation[] {
  const packages = discoverWorkspacePackages(workspaceRoot);
  return [...findDependencyViolations(packages), ...findVendorSdkViolations(packages)];
}

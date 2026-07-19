// Repo-wide default: the generic, framework-neutral config, since most
// workspace packages are not Next.js apps. `apps/web` overrides this with
// its own `root: true` config (see apps/web/.eslintrc.json), which uses
// `next/core-web-vitals` instead - Next-specific rules never apply outside
// apps/web, and non-Next packages never need eslint-config-next installed.
//
// Referenced by relative path, not package name: `packages/config/eslint`
// (like its `packages/config/prettier` and `packages/config/tsconfig`
// siblings - see the root .prettierrc.js for the same pattern) is not
// covered by any `workspaces` glob in the root package.json (those only
// reach one level into `packages/*`, not `packages/config/*`), so it isn't
// resolvable as `@nera/eslint-config` via node_modules. Changing the
// workspaces glob to make it resolvable is a bigger, unrelated structural
// change and out of scope here.
module.exports = {
  root: true,
  extends: [require.resolve('./packages/config/eslint/base.js')],
};

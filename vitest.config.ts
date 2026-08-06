import { fileURLToPath } from 'node:url';
import { transform as esbuildTransform } from 'esbuild';
import { defineConfig, type Plugin } from 'vitest/config';

// apps/web/tsconfig.json sets "jsx": "preserve" for Next's own SWC compiler,
// which Vitest's oxc transform can't consume directly - and oxc's own `jsx`
// transform option can't be scoped per file extension in this Vite version:
// setting it globally (`oxc: { jsx: 'automatic' }`) makes oxc reject every
// plain .ts file outright ("Invalid jsx option: 'automatic'", surfaced via
// vitest.setup.ts once `setupFiles` was added), while restricting it with
// `oxc.include` to only .tsx files instead disables oxc's TypeScript-stripping
// entirely for every excluded .ts file (breaking plain `.ts` source that
// oxc never even touches for JSX). Stripping JSX ourselves first - via
// esbuild, already a transitive dependency of Vite - avoids oxc ever seeing
// a `jsx` option at all: by the time oxc runs, .tsx files are already plain
// TypeScript with no JSX syntax left.
function stripJsxWithEsbuild(): Plugin {
  return {
    name: 'nera-strip-jsx-with-esbuild',
    enforce: 'pre',
    async transform(code, id) {
      if (!/\.tsx$/.test(id.split('?')[0])) return null;
      const result = await esbuildTransform(code, {
        loader: 'tsx',
        jsx: 'automatic',
        sourcefile: id,
        // 'external' (not `true`) - `true` makes esbuild's transform() API
        // *also* append an inline `//# sourceMappingURL=data:...base64,...`
        // comment directly into `code`, on top of returning `result.map`
        // separately. That inline comment's single line grew long enough
        // that Vite's own stack-trace sourcemap regex hit a real V8 regex
        // stack overflow while formatting an unrelated uncaught error from
        // jsdom, which masked the real error behind endless duplicate
        // crash reports instead of surfacing it.
        sourcemap: 'external',
      });
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  plugins: [stripJsxWithEsbuild()],
  resolve: {
    alias: {
      // Matches apps/web/tsconfig.json's "@/*": ["./*"] - needed so a test
      // can import apps/web/src/lib/actions/documentActions.ts (or
      // anything else that uses this alias), which no test file did
      // before P014's documentActions.filenameMetadata.test.ts.
      '@': fileURLToPath(new URL('./apps/web', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/src/**/*.test.{ts,tsx}', 'apps/**/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    // jest-dom's matcher extension has no jsdom dependency itself and is
    // inert unless a test actually uses one of its matchers, so registering
    // it globally is safe for the existing Node-environment tests. Real DOM
    // rendering still requires each test file to opt into jsdom itself via
    // a leading `// @vitest-environment jsdom` comment - the default
    // environment for every other test stays 'node', unchanged.
    setupFiles: ['./vitest.setup.ts'],
  },
});

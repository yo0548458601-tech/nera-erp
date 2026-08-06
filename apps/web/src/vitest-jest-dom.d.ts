// apps/web's tsconfig.json is its own standalone tsc program, scoped to
// files under apps/web - it never includes the repo-root vitest.setup.ts
// (where '@testing-library/jest-dom/vitest' is imported for its runtime
// matcher-registration side effect), so TypeScript never sees that import's
// ambient type augmentation of Vitest's `Assertion` interface (toBeInTheDocument,
// toHaveAttribute, toBeDisabled, etc.) unless it's referenced from a file
// that IS part of this program.
/// <reference types="@testing-library/jest-dom/vitest" />

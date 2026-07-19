export * from './permissions';
export * from './rules';

// `checkPermission` (checkPermission.ts) is deliberately NOT re-exported
// from this barrel. It depends on `@nera/database`, and this barrel is the
// same module `apps/web`'s `AuthorizationContext.tsx` already imports from
// (for the pure `resolveEffectivePermission`/`PermissionId` exports) -
// re-exporting it here would transitively pull `@nera/database` into the
// Next.js web build via that existing import, which is exactly the "wire a
// real caller into apps/web" step P011 explicitly defers (confirmed by a
// real `next build` failure during P011 validation: `@nera/database`'s
// `.js`-extension internal import does not resolve under webpack). Import
// `checkPermission`/`createAuthorizationEngine` directly from
// `@nera/authorization-engine/src/checkPermission` (or relatively, from
// within this package) until a future sprint wires a real caller and
// resolves that packaging gap.

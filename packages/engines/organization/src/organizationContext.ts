/**
 * Organization Context - the RLS-scoped unit-of-work primitive
 * (`ENGINE_MAP.md` Section 3; P012 - see `docs/ROADMAP.md`).
 *
 * `getOrganizationContext()` is the P012 infrastructure form of the
 * `getOrganizationContext(request)` contract `ENGINE_MAP.md` names. There is
 * no real request/session mechanism yet - Identity/Authentication is still
 * unbuilt - so `context` here is the narrowest honest shape available today:
 * an already-resolved `{ organizationId }`, not a literal HTTP/Next.js
 * request. A future Identity/Authentication sprint derives this same shape
 * from a verified request and calls this same function; the function's
 * signature does not need to change for that to happen (the same move P011
 * made for `checkPermission`'s explicit `actor` parameter, for the identical
 * reason).
 *
 * This function's responsibilities, and only these:
 *
 *   1. Open one Prisma interactive transaction.
 *   2. Set `app.current_organization_id` for that transaction, parameterized.
 *   3. Run `work` against that same transaction client.
 *   4. Return its result (the transaction commits on success, or rolls back
 *      - and the error propagates unchanged - if `work` throws).
 *
 * Deliberately, this file contains no role, no RLS test infrastructure, and
 * no notion of a restricted PostgreSQL role. Whatever role the injected
 * `client`'s connection happens to be running as is entirely the caller's
 * concern, not this function's - see
 * `packages/engines/organization/src/testSupport/restrictedRole.ts` for how
 * the test suite proves RLS enforcement, by wrapping the `work` callback
 * from the *outside*, never by this file knowing that role-switching exists.
 * This split is a deliberate P012 owner decision: production runtime code
 * must not contain test-only behavior.
 *
 * RLS is not relied on by this function for its own correctness beyond
 * setting the session variable the policies read - the actual isolation
 * guarantee comes from the database-level policies and (separately) from
 * whichever role the connection runs as, neither of which this file decides.
 */

import { prisma, type Prisma } from '@nera/database';

export type OrganizationContext = {
  organizationId: string;
};

export type OrganizationScopedWork<T> = (tx: Prisma.TransactionClient) => Promise<T>;

/** The minimal, structural slice of a Prisma-compatible client this function needs. */
export type OrganizationContextDbClient = {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

function assertValidOrganizationContext(context: OrganizationContext): void {
  if (typeof context?.organizationId !== 'string' || context.organizationId.trim().length === 0) {
    throw new Error(
      'getOrganizationContext: "organizationId" is required and must be a non-empty string.'
    );
  }
}

/**
 * Factory, matching `createAuditEngine`/`createAuthorizationEngine`'s
 * stateless-function convention. Defaults to the real, Prisma-backed
 * `@nera/database` client; tests inject a fake or the real client instead.
 * Construction never queries the database - `client` is only touched once
 * the returned function is actually called.
 */
export function createGetOrganizationContext(client: OrganizationContextDbClient = prisma) {
  return async function getOrganizationContext<T>(
    context: OrganizationContext,
    work: OrganizationScopedWork<T>
  ): Promise<T> {
    assertValidOrganizationContext(context);

    return client.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${context.organizationId}, true)`;
      return work(tx);
    });
  };
}

/**
 * TEST-ONLY. Never imported by `organizationContext.ts`,
 * `institutionOwnership.ts`, `index.ts`, or any other production file in
 * this package - that is the entire point (P012 owner decision: production
 * runtime code must not contain test-only behavior).
 *
 * `getOrganizationContext()` knows nothing about roles or RLS test
 * infrastructure - it just runs whatever `work` callback it is given, inside
 * the transaction it opened. This module supplies a `work`-wrapping
 * higher-order function that performs the restricted-role switch as the
 * *first* thing the wrapped callback does, before delegating to the real
 * test body - composed in from the outside, through `getOrganizationContext`'s
 * own `work` parameter, never through any change to `getOrganizationContext`
 * itself.
 *
 * Forgetting to wrap a behavioral RLS test's callback in `asRestrictedRole`
 * is fail-safe, not fail-silent: without the role switch, the connection
 * remains the table-owner/superuser connection, which FORCE ROW LEVEL
 * SECURITY does not bind - so a cross-organization isolation assertion in an
 * unwrapped test would observe the other organization's data and fail
 * loudly, rather than passing for the wrong reason.
 */

import { RLS_TEST_ROLE_NAME, type Prisma } from '@nera/database';

async function currentUser(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<
    Array<{ active_role: string }>
  >`SELECT current_user AS active_role`;
  return rows[0]?.active_role ?? '';
}

/**
 * Pure, independently unit-testable: throws unless `actual` matches
 * `expected`. Exported so "the verification logic itself is correct" can be
 * proven without a live database, separately from proving the real role
 * switch succeeds under normal bootstrap conditions.
 */
export function assertActiveRole(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(
      `Expected the transaction to be running as role "${expected}" but current_user is "${actual}" - the restricted-role switch did not take effect.`
    );
  }
}

/**
 * Wraps a behavioral RLS test's `work` callback so that, before it runs, the
 * transaction switches to the fixed, repository-controlled restricted role
 * and verifies the switch actually took effect. Use this around any `work`
 * passed to `getOrganizationContext()` in a test that asserts RLS isolation.
 */
export function asRestrictedRole<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>
): (tx: Prisma.TransactionClient) => Promise<T> {
  return async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RLS_TEST_ROLE_NAME}"`);
    assertActiveRole(await currentUser(tx), RLS_TEST_ROLE_NAME);
    return work(tx);
  };
}

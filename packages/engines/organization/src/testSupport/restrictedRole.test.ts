import { describe, expect, it } from 'vitest';
import { assertActiveRole } from './restrictedRole';

/**
 * Pure, no-database unit test for the role-verification logic itself -
 * proving the check is correct in isolation, separately from proving the
 * real role switch succeeds under normal bootstrap conditions (which is
 * exercised, against a real database, by organizationContext.test.ts's
 * behavioral RLS suite via `asRestrictedRole`).
 */
describe('assertActiveRole', () => {
  it('does not throw when the active role matches the expected role', () => {
    expect(() => assertActiveRole('nera_rls_test_role', 'nera_rls_test_role')).not.toThrow();
  });

  it('throws when the active role does not match - the restricted-role switch did not take effect', () => {
    expect(() => assertActiveRole('postgres', 'nera_rls_test_role')).toThrow(
      /restricted-role switch did not take effect/
    );
  });

  it('throws when the active role is empty (e.g. a malformed query result)', () => {
    expect(() => assertActiveRole('', 'nera_rls_test_role')).toThrow();
  });
});

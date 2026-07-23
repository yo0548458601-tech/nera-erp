import { describe, expect, it } from 'vitest';
import { demoSystemUsers } from './demoUsers';
import { demoUser } from '../auth/demoData';
import { DEMO_USER_PROFILE_ID } from '../auth/demoIdentity';

/**
 * Regression test for a verified P013A production bug (see the
 * implementation report): `demoSystemUsers` (this file) is a separate,
 * parallel dataset from `demoUser`/`demoData.ts`, keyed by the same user id
 * but never mechanically kept in sync with it. P013A repointed `demoUser.id`
 * at the real seeded UserProfile id but missed updating this file, leaving
 * it keyed on the old `'demo-user'` placeholder string.
 * `AuthorizationContext.tsx`'s `resolveMyPermission` looks up the signed-in
 * demo user's roleIds here by matching `session.user.id` (which is
 * `demoUser.id`) - a mismatch silently resolves every `useMyPermission(...)`
 * check app-wide to deny, with no error, no thrown exception, nothing
 * visibly wrong except every permission-gated control failing to render
 * (e.g. the phone/email/address "add" buttons in PersonFormDialog).
 */
describe('demoSystemUsers / demoUser id consistency', () => {
  it('contains an entry whose id matches demoUser.id (the signed-in demo session user)', () => {
    const match = demoSystemUsers.find(user => user.id === demoUser.id);
    expect(match).toBeDefined();
  });

  it('that entry is keyed on the real seeded UserProfile id, not a stale placeholder', () => {
    const match = demoSystemUsers.find(user => user.id === DEMO_USER_PROFILE_ID);
    expect(match).toBeDefined();
    expect(match?.roleIds).not.toHaveLength(0);
  });

  it('demoUser.id and DEMO_USER_PROFILE_ID have not silently diverged from each other', () => {
    expect(demoUser.id).toBe(DEMO_USER_PROFILE_ID);
  });
});

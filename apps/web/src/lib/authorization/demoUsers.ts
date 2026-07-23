import { DEMO_USER_PROFILE_ID } from '../auth/demoIdentity';

/**
 * The operator accounts the administrator can configure permissions for.
 * This is a separate, minimal concept from Entity Engine person records
 * (a "system user" is a login/operator account; a Person entity is
 * someone the organization knows about) - in a real system they would
 * often be linked, but that link does not exist in this demo.
 */
export type DemoSystemUser = {
  id: string;
  name: string;
  /** Authorization role ids (see demoPermissionRules) - distinct from Entity Engine business roles like "employee"/"donor". */
  roleIds: string[];
};

/**
 * `id` must match `demoUser.id` (`demoData.ts`), which P013A repointed at
 * the real seeded UserProfile id (`DEMO_USER_PROFILE_ID`) - this array was
 * missed in that change, leaving it keyed on the old placeholder
 * `'demo-user'` string. Since `resolveMyPermission` (AuthorizationContext.tsx)
 * looks up the signed-in demo user's roleIds here by matching
 * `session.user.id`, the stale id meant every `useMyPermission(...)` check
 * app-wide silently resolved to deny - including `contact_methods.edit`,
 * which is why the phone/email/address editors never rendered any
 * add/edit controls. Verified P013A bug - see the implementation report.
 */
export const demoSystemUsers: DemoSystemUser[] = [
  { id: DEMO_USER_PROFILE_ID, name: 'מנהל מערכת', roleIds: ['administrator'] },
  { id: 'user-rivka', name: 'רבקה לוי', roleIds: ['staff'] },
  { id: 'user-eli', name: 'אליהו פרץ', roleIds: ['staff'] },
];

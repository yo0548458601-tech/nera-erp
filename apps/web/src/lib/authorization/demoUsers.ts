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

export const demoSystemUsers: DemoSystemUser[] = [
  { id: 'demo-user', name: 'מנהל מערכת', roleIds: ['administrator'] },
  { id: 'user-rivka', name: 'רבקה לוי', roleIds: ['staff'] },
  { id: 'user-eli', name: 'אליהו פרץ', roleIds: ['staff'] },
];

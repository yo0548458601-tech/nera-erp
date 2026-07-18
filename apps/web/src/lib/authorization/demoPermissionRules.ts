import { permissionRegistry, type PermissionId, type PermissionRule } from '@nera/authorization-engine';

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function systemRule(permission: PermissionId, decision: 'allow' | 'deny', id: string): PermissionRule {
  return { id, scope: 'system', permission, decision, updatedAt: SEED_TIMESTAMP };
}

function roleRule(roleId: string, permission: PermissionId, decision: 'allow' | 'deny', id: string): PermissionRule {
  return { id, scope: 'role', targetId: roleId, permission, decision, updatedAt: SEED_TIMESTAMP };
}

/**
 * Demo seed for the authorization model. Deliberately conservative at the
 * system level (deny-by-default, per ADR-0003), with the 'administrator'
 * role granted broad access for demo purposes (the current signed-in demo
 * user has this role) and the 'staff' role granted a narrower, more
 * realistic everyday set. No user-level overrides are seeded - those are
 * created live from the settings UI so the precedence model is genuinely
 * demonstrable rather than pre-baked.
 */
export const demoPermissionRules: PermissionRule[] = [
  // System defaults: deny everything unless a more specific scope says otherwise.
  ...permissionRegistry.map((definition, index) => systemRule(definition.id, 'deny', `sys-${index}`)),

  // Administrator role: broad demo access, matching "the current signed-in administrator may be granted broad demo permissions for testing".
  ...permissionRegistry.map((definition, index) => roleRule('administrator', definition.id, 'allow', `role-admin-${index}`)),

  // Staff role: everyday capabilities only - notably NOT delete/restore/merge/override/finance-priority/import-export.
  roleRule('staff', 'notes.edit', 'allow', 'role-staff-notes-edit'),
  roleRule('staff', 'entities.edit', 'allow', 'role-staff-entities-edit'),
  roleRule('staff', 'entities.roles.manage', 'allow', 'role-staff-roles-manage'),
  roleRule('staff', 'finance.view', 'allow', 'role-staff-finance-view'),
];

/**
 * Generic, platform-wide field-state configuration: whether ANY field -
 * a built-in field (e.g. a person's birth date) or an administrator's own
 * custom field (see customFields.ts) - is hidden, optional, required, or
 * read-only for a given context. This is not specific to any one field;
 * `fieldKey` is an arbitrary string, and every function here operates on
 * whatever rules/context are passed in. A screen wires a *specific* field
 * into this system by resolving against its own fieldKey and context -
 * see apps/web/src/context/FieldRequirementContext.tsx and
 * apps/web/src/config/configurableFields.ts for the (currently: birth
 * date) app-layer registration, which is deliberately built as an
 * extensible list rather than a single hardcoded field so a future field
 * (built-in or custom) can register into the same system without new
 * engine code.
 *
 * Precedence (most specific wins first - documented here since, unlike
 * permissions/list-columns, the platform has not previously fixed an order
 * for this axis): role definition -> institution -> entity type -> module
 * -> built-in default. A role is more specific than an entity type (it
 * narrows within one), and an institution's own policy is treated as more
 * specific than a bare entity-type default but less specific than a
 * concrete role's own requirement.
 */
export type FieldRequirementMode = 'hidden' | 'optional' | 'required' | 'read_only';

export type FieldRequirementScope = 'role' | 'institution' | 'entity_type' | 'module';

export type FieldRequirementRule = {
  id: string;
  fieldKey: string;
  scope: FieldRequirementScope;
  /** A RoleDefinition.key for 'role' scope, an institution id for 'institution' scope, an EntityType for 'entity_type' scope, a module id for 'module' scope. */
  targetId?: string;
  mode: FieldRequirementMode;
  updatedAt: string;
  updatedByUserId?: string;
};

export type FieldRequirementContext = {
  entityType: 'person' | 'organization';
  /** The single role-key context being resolved - see mergeFieldRequirementModes for how a screen with several simultaneously-relevant roles combines more than one result from this. */
  roleKey?: string;
  institutionId?: string;
  moduleId?: string;
};

export type EffectiveFieldRequirement = {
  fieldKey: string;
  mode: FieldRequirementMode;
  source: FieldRequirementScope | 'default';
};

/** Resolves the effective mode for a single role-key context. */
export function resolveFieldRequirement(
  fieldKey: string,
  context: FieldRequirementContext,
  rules: FieldRequirementRule[],
  builtInDefault: FieldRequirementMode
): EffectiveFieldRequirement {
  const forField = rules.filter(rule => rule.fieldKey === fieldKey);

  const roleRule = context.roleKey
    ? forField.find(rule => rule.scope === 'role' && rule.targetId === context.roleKey)
    : undefined;
  if (roleRule) {
    return { fieldKey, mode: roleRule.mode, source: 'role' };
  }

  const institutionRule = context.institutionId
    ? forField.find(rule => rule.scope === 'institution' && rule.targetId === context.institutionId)
    : undefined;
  if (institutionRule) {
    return { fieldKey, mode: institutionRule.mode, source: 'institution' };
  }

  const entityTypeRule = forField.find(
    rule => rule.scope === 'entity_type' && rule.targetId === context.entityType
  );
  if (entityTypeRule) {
    return { fieldKey, mode: entityTypeRule.mode, source: 'entity_type' };
  }

  const moduleRule = context.moduleId
    ? forField.find(rule => rule.scope === 'module' && rule.targetId === context.moduleId)
    : undefined;
  if (moduleRule) {
    return { fieldKey, mode: moduleRule.mode, source: 'module' };
  }

  return { fieldKey, mode: builtInDefault, source: 'default' };
}

/**
 * Merges several resolved modes (e.g. one per role currently selected/
 * assigned on a record with more than one simultaneous role) into a
 * single effective mode, per the documented "strictest-visible-wins"
 * policy: required beats read-only beats optional beats hidden. A role
 * that needs a field editable is never silently overridden by another
 * role that doesn't care about it; a role that needs it merely visible
 * (read-only or optional) is never silently hidden by another role that
 * doesn't mention it either. Only hidden when EVERY resolved mode says
 * hidden. Lives in the engine (not just the app layer) so any future
 * screen with a multi-role merge need reuses the same, single policy.
 */
export function mergeFieldRequirementModes(modes: FieldRequirementMode[]): FieldRequirementMode {
  if (modes.includes('required')) {
    return 'required';
  }
  if (modes.includes('read_only')) {
    return 'read_only';
  }
  if (modes.includes('optional')) {
    return 'optional';
  }
  return 'hidden';
}

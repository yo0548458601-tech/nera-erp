import { type PermissionId } from './permissions';

/**
 * The four configuration scopes a permission rule can be written at, from
 * broadest to most specific. This is a fixed set today; if a future scope
 * is ever needed (e.g. "branch"), add it here and to the precedence order
 * in resolveEffectivePermission - nothing else needs to change shape.
 */
export type PermissionScope = 'system' | 'institution' | 'role' | 'user';

/**
 * 'inherit' means "no opinion at this scope - fall through to the next
 * broader scope". Only 'allow' and 'deny' are terminal decisions.
 */
export type PermissionDecision = 'inherit' | 'allow' | 'deny';

export type PermissionRule = {
  id: string;
  scope: PermissionScope;
  /**
   * What this rule applies to: an institution id for 'institution' scope,
   * a role id for 'role' scope, a user id for 'user' scope. Undefined for
   * 'system' scope, which applies to everyone.
   */
  targetId?: string;
  permission: PermissionId;
  decision: PermissionDecision;
  updatedAt: string;
  updatedByUserId?: string;
};

export type PermissionContext = {
  userId: string;
  roleIds: string[];
  institutionId?: string;
};

export type EffectivePermissionResult = {
  permission: PermissionId;
  /** The resolved, terminal decision - never 'inherit'. Defaults to 'deny' when nothing matches (see ADR-0003: default deny). */
  decision: 'allow' | 'deny';
  source: PermissionScope | 'default';
  sourceRuleId?: string;
};

/**
 * Resolution precedence (most specific wins first, matching the approved
 * product decision):
 *
 *   individual user override -> role configuration -> institution
 *   configuration -> system default -> (nothing matched) default deny
 *
 * A rule with decision 'inherit' is treated as "no opinion" and the
 * resolver keeps looking at the next broader scope. The first scope that
 * yields an explicit 'allow' or 'deny' wins outright - a user-level deny
 * is therefore never overridden by a broader allow, because resolution
 * stops at the user scope as soon as an explicit decision is found there.
 *
 * This is a pure, client-side demo resolver. It exists to drive the demo
 * UI and to define the contract a future server-side Authorization Engine
 * must honor - it is not itself a security boundary. Hiding a button
 * based on this result is a UX convenience, not enforcement.
 */
export function resolveEffectivePermission(
  permission: PermissionId,
  context: PermissionContext,
  rules: PermissionRule[]
): EffectivePermissionResult {
  const userRule = rules.find(
    rule =>
      rule.scope === 'user' &&
      rule.targetId === context.userId &&
      rule.permission === permission &&
      rule.decision !== 'inherit'
  );
  if (userRule) {
    return {
      permission,
      decision: userRule.decision as 'allow' | 'deny',
      source: 'user',
      sourceRuleId: userRule.id,
    };
  }

  const roleRule = rules.find(
    rule =>
      rule.scope === 'role' &&
      rule.targetId !== undefined &&
      context.roleIds.includes(rule.targetId) &&
      rule.permission === permission &&
      rule.decision !== 'inherit'
  );
  if (roleRule) {
    return {
      permission,
      decision: roleRule.decision as 'allow' | 'deny',
      source: 'role',
      sourceRuleId: roleRule.id,
    };
  }

  const institutionRule = rules.find(
    rule =>
      rule.scope === 'institution' &&
      rule.targetId === context.institutionId &&
      rule.permission === permission &&
      rule.decision !== 'inherit'
  );
  if (institutionRule) {
    return {
      permission,
      decision: institutionRule.decision as 'allow' | 'deny',
      source: 'institution',
      sourceRuleId: institutionRule.id,
    };
  }

  const systemRule = rules.find(
    rule => rule.scope === 'system' && rule.permission === permission && rule.decision !== 'inherit'
  );
  if (systemRule) {
    return {
      permission,
      decision: systemRule.decision as 'allow' | 'deny',
      source: 'system',
      sourceRuleId: systemRule.id,
    };
  }

  return { permission, decision: 'deny', source: 'default' };
}

export function isAllowed(result: EffectivePermissionResult): boolean {
  return result.decision === 'allow';
}

import { type PermissionId } from './permissions';

/**
 * The four configuration scopes a permission rule can be written at, from
 * broadest to most specific. This is a fixed set today; if a future scope
 * is ever needed (e.g. "branch"), add it here and to the precedence order
 * in resolveEffectivePermission - nothing else needs to change shape.
 *
 * Scope-naming reconciliation (P011, documented per `ENGINE_MAP.md` Section
 * 2 and ADR-008's own follow-up - not a new architectural decision, no new
 * ADR): `'institution'` here currently means **Organization**, not a real
 * ADR-002 Institution. Organization is the only implemented tenant/security
 * boundary today (ADR-002); no `institutions` table exists yet, so this
 * scope literal cannot mean anything else in practice. This reconciliation
 * is intentionally narrow - it does not resolve the future relationship
 * between Organization, Institution, Branch and Department (ADR-008's own
 * follow-up leaves that open for whenever those hierarchy levels are real).
 * The literal is not renamed here, to avoid a breaking change to this
 * package's existing consumers (`apps/web`'s demo UI), which is out of
 * scope for P011.
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
 *
 * As of P011, `checkPermission()` (`checkPermission.ts`, in this same
 * package) is that authoritative server-side engine: a real, Prisma-backed
 * decision against `MembershipRole`/`RolePermission`. This function remains
 * exactly what it always was - a pure, non-authoritative UI hint - and is
 * not wired to `checkPermission()` in any way; the two are not kept in sync
 * automatically, and callers must not treat this function's result as
 * enforcement, only as a hint for what the UI should show.
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

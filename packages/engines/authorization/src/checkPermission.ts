/**
 * Server-side Authorization Engine (`ENGINE_MAP.md` Section 2; P011 - see
 * `docs/ROADMAP.md`).
 *
 * `checkPermission()` is the authoritative decision function this package
 * exposes: a real, Prisma-backed resolution against the tables that already
 * exist from P004 (`OrganizationMembership`, `MembershipRole`,
 * `RolePermission`, `Permission`). This is the only Organization/Role
 * enforcement path built in P011 - `resolveEffectivePermission()` in
 * `rules.ts` remains a pure, in-memory, non-authoritative UI hint (see that
 * file's own doc comment for the distinction).
 *
 * Scope, deliberately narrower than ADR-008's full hierarchy
 * (`Organization -> Branch -> Department -> Role -> User`): only the
 * Organization/Role slice that is actually persisted today is implemented.
 * There is no user-level override table and no Branch/Department table, so
 * this engine resolves exactly one chain:
 *
 *   MembershipRole -> RolePermission -> allow/deny
 *
 * Per the owner-approved P011 scope decision, adding a user-level override
 * table (or any other schema change) is explicitly out of scope for this
 * sprint - see `docs/ENGINE_MAP.md` Section 2 for the full reconciliation
 * note, including why the legacy `PermissionScope` value `'institution'`
 * (see `rules.ts`) currently means Organization, not a real ADR-002
 * Institution.
 *
 * Database access path (mirrors the P010 `@nera/audit-engine` precedent,
 * owner-approved again for P011):
 *
 *   @nera/authorization-engine -> @nera/database
 *
 * Not bound behind `@nera/core`'s `DatabaseProvider` contract, for the same
 * reason `@nera/audit-engine` isn't (ADR-009 leaves that contract
 * deliberately unbound).
 *
 * This engine never trusts a caller-supplied role. `CheckPermissionInput`
 * has no `roleIds` field at all - every role is resolved server-side from
 * `MembershipRole`, scoped to the membership and organization being checked.
 *
 * RLS is not relied on for correctness here: every query below carries its
 * own explicit `organizationId` filter. RLS (already enabled on these tables
 * since the P004 migration) is a second, independent layer this engine does
 * not depend on and does not configure - see `docs/ENGINE_MAP.md` and
 * `docs/ROADMAP.md` for why wiring the RLS session context is Organization /
 * Institution Engine (P012) work, not Authorization's.
 *
 * There are no permission-rule mutations in this sprint (`checkPermission`
 * is read-only), so there is nothing yet to audit or publish - this package
 * takes no dependency on `@nera/audit-engine` or `@nera/event-bus-engine`.
 *
 * Testing note (owner decision, P011, matching P010): automated tests use a
 * fake/mocked `AuthorizationDbClient`, never a live Postgres connection.
 *
 * Error handling: a database error (a rejected client call) is never
 * swallowed or converted into a deny result - it propagates to the caller
 * unchanged, so infrastructure failure is never confused with a genuine
 * authorization decision. The only "safe deny" outcomes are the specific,
 * documented data-driven cases in `CheckPermissionReason` below (unknown
 * membership, organization mismatch, actor mismatch, inactive membership,
 * unknown permission, or no matching rule) - never a caught exception.
 */

import {
  appPrisma,
  type OrganizationMembershipStatus,
  type RolePermissionEffect,
} from '@nera/database';
import type { PermissionId } from './permissions';

/**
 * The minimal, structural slice of a Prisma-compatible client this engine
 * needs - satisfied by the real `prisma` client from `@nera/database`, and
 * by any test fake that implements just these four methods. Not a new
 * vendor-abstraction layer (binding a provider contract is out of scope for
 * P011, same as P010) - just the smallest possible seam for dependency
 * injection in tests, matching `AuditLogDbClient`'s own convention.
 */
export type AuthorizationDbClient = {
  organizationMembership: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      organizationId: string;
      userProfileId: string;
      status: OrganizationMembershipStatus;
      deletedAt: Date | null;
    } | null>;
  };
  membershipRole: {
    findMany(args: {
      where: { organizationId: string; organizationMembershipId: string };
    }): Promise<Array<{ roleId: string }>>;
  };
  permission: {
    findUnique(args: { where: { permissionKey: string } }): Promise<{ id: string } | null>;
  };
  rolePermission: {
    findMany(args: {
      where: { organizationId: string; roleId: { in: string[] }; permissionId: string };
    }): Promise<Array<{ effect: RolePermissionEffect }>>;
  };
};

/**
 * The actor making the request. Both fields are required and are
 * cross-checked against the real `OrganizationMembership` row - neither is
 * trusted on its own. There is deliberately no `roleIds` field anywhere in
 * this module's public input: every role this engine acts on is looked up
 * server-side via `MembershipRole`, never supplied by the caller.
 */
export type CheckPermissionActor = {
  userProfileId: string;
  membershipId: string;
};

export type CheckPermissionInput = {
  /** The tenant boundary every lookup below is scoped by. Always required. */
  organizationId: string;
  actor: CheckPermissionActor;
  permission: PermissionId;
};

export type CheckPermissionDecision = 'allow' | 'deny';

/**
 * Why the decision came out the way it did - always present, per
 * `NERA_CONSTITUTION.md` Section 11 (Explainability): every decision this
 * engine returns states *why*, not just *what*.
 *
 * - 'role-allow' - at least one assigned role has a matching allow rule, and
 *   no assigned role has a matching deny rule.
 * - 'role-deny' - at least one assigned role has a matching deny rule
 *   (deny always wins over a conflicting allow from another role).
 * - 'default-deny' - the actor is a real, active member of this
 *   organization and the permission is real, but no assigned role has any
 *   matching rule at all.
 * - 'unknown-membership' - no `OrganizationMembership` row exists for
 *   `actor.membershipId`.
 * - 'organization-mismatch' - the membership exists but belongs to a
 *   different organization than `organizationId`.
 * - 'actor-mismatch' - the membership exists, in the right organization,
 *   but does not belong to the claimed `actor.userProfileId` ("unknown
 *   actor").
 * - 'inactive-membership' - the membership exists, in the right
 *   organization, belongs to the right actor, but is not active (status is
 *   not `'active'`, or it has been soft-deleted).
 * - 'unknown-permission' - `permission` does not match any row in the
 *   `Permission` catalog.
 */
export type CheckPermissionReason =
  | 'role-allow'
  | 'role-deny'
  | 'default-deny'
  | 'unknown-membership'
  | 'organization-mismatch'
  | 'actor-mismatch'
  | 'inactive-membership'
  | 'unknown-permission';

export type CheckPermissionResult = {
  permission: PermissionId;
  decision: CheckPermissionDecision;
  reason: CheckPermissionReason;
};

export type AuthorizationEngine = {
  checkPermission(input: CheckPermissionInput): Promise<CheckPermissionResult>;
};

function deny(permission: PermissionId, reason: CheckPermissionReason): CheckPermissionResult {
  return { permission, decision: 'deny', reason };
}

function assertValidCheckPermissionInput(input: CheckPermissionInput): void {
  const requiredStrings: Array<[string, unknown]> = [
    ['organizationId', input.organizationId],
    ['actor.userProfileId', input.actor?.userProfileId],
    ['actor.membershipId', input.actor?.membershipId],
    ['permission', input.permission],
  ];

  for (const [label, value] of requiredStrings) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`checkPermission: "${label}" is required and must be a non-empty string.`);
    }
  }
}

/**
 * Factory, not a singleton - matches `createAuditEngine` and the rest of
 * `packages/engines/*`'s stateless-function convention. Defaults to
 * `appPrisma`, the least-privilege application client (P013A) - the safe
 * client is the default so a production caller can write
 * `createAuthorizationEngine()` with no arguments and never has to remember
 * to request it; tests inject a fake `AuthorizationDbClient` explicitly
 * instead. Construction never queries the database - `client` is only
 * touched once `checkPermission()` is actually called.
 */
export function createAuthorizationEngine(
  client: AuthorizationDbClient = appPrisma
): AuthorizationEngine {
  return {
    async checkPermission(input) {
      assertValidCheckPermissionInput(input);

      const { organizationId, actor, permission } = input;

      // Resolve the membership by id only - never pre-filtered by
      // organizationId - so an organization mismatch can be reported as its
      // own distinct, explainable reason instead of being indistinguishable
      // from "no such membership at all".
      const membership = await client.organizationMembership.findUnique({
        where: { id: actor.membershipId },
      });

      if (!membership) {
        return deny(permission, 'unknown-membership');
      }
      if (membership.organizationId !== organizationId) {
        return deny(permission, 'organization-mismatch');
      }
      if (membership.userProfileId !== actor.userProfileId) {
        return deny(permission, 'actor-mismatch');
      }
      if (membership.deletedAt !== null || membership.status !== 'active') {
        return deny(permission, 'inactive-membership');
      }

      const roles = await client.membershipRole.findMany({
        where: { organizationId, organizationMembershipId: membership.id },
      });
      const roleIds = roles.map(role => role.roleId);

      if (roleIds.length === 0) {
        return deny(permission, 'default-deny');
      }

      const permissionRow = await client.permission.findUnique({
        where: { permissionKey: permission },
      });
      if (!permissionRow) {
        return deny(permission, 'unknown-permission');
      }

      const rolePermissions = await client.rolePermission.findMany({
        where: { organizationId, roleId: { in: roleIds }, permissionId: permissionRow.id },
      });

      if (rolePermissions.some(rule => rule.effect === 'deny')) {
        return { permission, decision: 'deny', reason: 'role-deny' };
      }
      if (rolePermissions.some(rule => rule.effect === 'allow')) {
        return { permission, decision: 'allow', reason: 'role-allow' };
      }
      return deny(permission, 'default-deny');
    },
  };
}

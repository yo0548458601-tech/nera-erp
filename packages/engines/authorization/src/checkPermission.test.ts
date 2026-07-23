import { describe, expect, it, vi } from 'vitest';
import { appPrisma, prisma } from '@nera/database';
import {
  createAuthorizationEngine,
  type AuthorizationDbClient,
  type CheckPermissionInput,
} from './checkPermission';
import { resolveEffectivePermission } from './rules';
import type { PermissionId } from './permissions';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const USER = 'user-1';
const MEMBERSHIP = 'membership-1';
const PERMISSION: PermissionId = 'entities.edit';
const OTHER_PERMISSION: PermissionId = 'finance.view';
const PERMISSION_ROW_ID = 'permission-row-entities-edit';
const OTHER_PERMISSION_ROW_ID = 'permission-row-finance-view';
const ROLE_A = 'role-a';
const ROLE_B = 'role-b';

type FakeMembership = {
  id: string;
  organizationId: string;
  userProfileId: string;
  status: 'active' | 'invited' | 'pending' | 'suspended' | 'left';
  deletedAt: Date | null;
};

const activeMembership: FakeMembership = {
  id: MEMBERSHIP,
  organizationId: ORG,
  userProfileId: USER,
  status: 'active',
  deletedAt: null,
};

const catalog = [
  { permissionKey: PERMISSION, id: PERMISSION_ROW_ID },
  { permissionKey: OTHER_PERMISSION, id: OTHER_PERMISSION_ROW_ID },
];

const validInput: CheckPermissionInput = {
  organizationId: ORG,
  actor: { userProfileId: USER, membershipId: MEMBERSHIP },
  permission: PERMISSION,
};

/** Shared shape for a fake client whose methods are directly-assertable `vi.fn()` mocks. */
type FakeAuthorizationDbClient = AuthorizationDbClient & {
  organizationMembership: { findUnique: ReturnType<typeof vi.fn> };
  membershipRole: { findMany: ReturnType<typeof vi.fn> };
  permission: { findUnique: ReturnType<typeof vi.fn> };
  rolePermission: { findMany: ReturnType<typeof vi.fn> };
};

/**
 * A bare fake with no default behavior - every method returns `undefined`
 * unless a test configures it. Used for construction/validation/error-
 * propagation tests where the exact call sequence is being asserted, not
 * realistic filtering. Cast via `unknown` because an un-implemented `vi.fn()`
 * types as a generic mock, not the specific structural signature each method
 * requires - the same reason `.mockResolvedValue`/`.mockRejectedValue` are
 * used to configure behavior per test rather than passing an implementation
 * up front.
 */
function createFakeClient(): FakeAuthorizationDbClient {
  return {
    organizationMembership: { findUnique: vi.fn() },
    membershipRole: { findMany: vi.fn() },
    permission: { findUnique: vi.fn() },
    rolePermission: { findMany: vi.fn() },
  } as unknown as FakeAuthorizationDbClient;
}

/**
 * A realistic in-memory fake that actually filters by the `where` clause the
 * engine passes, the same way Prisma would - not just a stub that returns a
 * fixed value regardless of arguments. This is what lets tests like
 * "unrelated organization rows ignored" genuinely prove the engine's query
 * construction is correct, rather than only proving it calls the mock.
 */
function createFilteringFakeClient(options: {
  membership?: FakeMembership | null;
  membershipRoles?: Array<{
    organizationId: string;
    organizationMembershipId: string;
    roleId: string;
  }>;
  permissions?: Array<{ permissionKey: string; id: string }>;
  rolePermissions?: Array<{
    organizationId: string;
    roleId: string;
    permissionId: string;
    effect: 'allow' | 'deny';
  }>;
}) {
  const membership = options.membership ?? null;
  const membershipRoles = options.membershipRoles ?? [];
  const permissions = options.permissions ?? [];
  const rolePermissions = options.rolePermissions ?? [];

  const findUniqueMembership = vi.fn(async ({ where }: { where: { id: string } }) =>
    membership && membership.id === where.id ? membership : null
  );

  const findManyMembershipRoles = vi.fn(
    async ({ where }: { where: { organizationId: string; organizationMembershipId: string } }) =>
      membershipRoles
        .filter(
          row =>
            row.organizationId === where.organizationId &&
            row.organizationMembershipId === where.organizationMembershipId
        )
        .map(row => ({ roleId: row.roleId }))
  );

  const findUniquePermission = vi.fn(async ({ where }: { where: { permissionKey: string } }) => {
    const match = permissions.find(row => row.permissionKey === where.permissionKey);
    return match ? { id: match.id } : null;
  });

  const findManyRolePermissions = vi.fn(
    async ({
      where,
    }: {
      where: { organizationId: string; roleId: { in: string[] }; permissionId: string };
    }) =>
      rolePermissions
        .filter(
          row =>
            row.organizationId === where.organizationId &&
            where.roleId.in.includes(row.roleId) &&
            row.permissionId === where.permissionId
        )
        .map(row => ({ effect: row.effect }))
  );

  return {
    organizationMembership: { findUnique: findUniqueMembership },
    membershipRole: { findMany: findManyMembershipRoles },
    permission: { findUnique: findUniquePermission },
    rolePermission: { findMany: findManyRolePermissions },
  };
}

describe('createAuthorizationEngine', () => {
  it('exposes exactly one public method - checkPermission', () => {
    const engine = createAuthorizationEngine(createFakeClient());
    expect(Object.keys(engine)).toEqual(['checkPermission']);
  });

  it('does not connect to or query the database at construction time', () => {
    const fake = createFakeClient();

    expect(() => createAuthorizationEngine(fake)).not.toThrow();

    expect(fake.organizationMembership.findUnique).not.toHaveBeenCalled();
    expect(fake.membershipRole.findMany).not.toHaveBeenCalled();
    expect(fake.permission.findUnique).not.toHaveBeenCalled();
    expect(fake.rolePermission.findMany).not.toHaveBeenCalled();
  });

  it('defaults to appPrisma, the least-privilege application client (P013A) - never the administrative prisma client - when no client is injected', () => {
    // Constructing with no argument must not throw - it binds to the
    // already-imported `appPrisma` client. No connection is attempted at
    // construction time; Prisma connects lazily on first query.
    expect(() => createAuthorizationEngine()).not.toThrow();
    expect(appPrisma).not.toBe(prisma);
  });

  describe('input validation', () => {
    const mutations: Array<[string, (input: CheckPermissionInput) => CheckPermissionInput]> = [
      ['organizationId', input => ({ ...input, organizationId: '' })],
      ['organizationId', input => ({ ...input, organizationId: undefined as unknown as string })],
      [
        'actor.userProfileId',
        input => ({ ...input, actor: { ...input.actor, userProfileId: '   ' } }),
      ],
      ['actor.membershipId', input => ({ ...input, actor: { ...input.actor, membershipId: '' } })],
      [
        'actor',
        input => ({ ...input, actor: undefined as unknown as CheckPermissionInput['actor'] }),
      ],
      ['permission', input => ({ ...input, permission: '' as PermissionId })],
    ];

    for (const [label, mutate] of mutations) {
      it(`rejects an invalid "${label}"`, async () => {
        const fake = createFakeClient();
        const engine = createAuthorizationEngine(fake);

        await expect(engine.checkPermission(mutate(validInput))).rejects.toThrow(
          new RegExp(label.replace('.', '\\.'))
        );
        expect(fake.organizationMembership.findUnique).not.toHaveBeenCalled();
      });
    }
  });

  describe('resolution against MembershipRole / RolePermission', () => {
    it('denies by default when the membership has no assigned roles at all', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [],
        permissions: catalog,
        rolePermissions: [],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'deny', reason: 'default-deny' });
      // No roles to resolve rules for - the engine must short-circuit
      // rather than issuing pointless catalog/rule lookups.
      expect(fake.permission.findUnique).not.toHaveBeenCalled();
      expect(fake.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('denies by default when the assigned role has no matching rule', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
        ],
        permissions: catalog,
        rolePermissions: [],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'deny', reason: 'default-deny' });
    });

    it('allows when the single assigned role has a matching allow rule', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
        ],
        permissions: catalog,
        rolePermissions: [
          { organizationId: ORG, roleId: ROLE_A, permissionId: PERMISSION_ROW_ID, effect: 'allow' },
        ],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'allow', reason: 'role-allow' });
    });

    it('denies when the single assigned role has a matching deny rule', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
        ],
        permissions: catalog,
        rolePermissions: [
          { organizationId: ORG, roleId: ROLE_A, permissionId: PERMISSION_ROW_ID, effect: 'deny' },
        ],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'deny', reason: 'role-deny' });
    });

    it('allows when multiple assigned roles agree on allow', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_B },
        ],
        permissions: catalog,
        rolePermissions: [
          { organizationId: ORG, roleId: ROLE_A, permissionId: PERMISSION_ROW_ID, effect: 'allow' },
          { organizationId: ORG, roleId: ROLE_B, permissionId: PERMISSION_ROW_ID, effect: 'allow' },
        ],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'allow', reason: 'role-allow' });
    });

    it('denies when assigned roles conflict - deny always wins over an allow from another role', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_B },
        ],
        permissions: catalog,
        rolePermissions: [
          { organizationId: ORG, roleId: ROLE_A, permissionId: PERMISSION_ROW_ID, effect: 'allow' },
          { organizationId: ORG, roleId: ROLE_B, permissionId: PERMISSION_ROW_ID, effect: 'deny' },
        ],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'deny', reason: 'role-deny' });
    });

    it('ignores RolePermission rows written for a different permission', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
        ],
        permissions: catalog,
        rolePermissions: [
          // Allow exists for the same role/org, but for a different permission.
          {
            organizationId: ORG,
            roleId: ROLE_A,
            permissionId: OTHER_PERMISSION_ROW_ID,
            effect: 'allow',
          },
        ],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'deny', reason: 'default-deny' });
    });

    it('ignores RolePermission rows scoped to a different organization', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
        ],
        permissions: catalog,
        rolePermissions: [
          // Same role and permission, but recorded under a different organization.
          {
            organizationId: OTHER_ORG,
            roleId: ROLE_A,
            permissionId: PERMISSION_ROW_ID,
            effect: 'allow',
          },
        ],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({ permission: PERMISSION, decision: 'deny', reason: 'default-deny' });
    });
  });

  describe('safe-deny cases (unknown/mismatched actor, membership, permission)', () => {
    it('denies when the membership does not exist', async () => {
      const fake = createFilteringFakeClient({ membership: null, permissions: catalog });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({
        permission: PERMISSION,
        decision: 'deny',
        reason: 'unknown-membership',
      });
    });

    it('denies when the membership belongs to a different organization', async () => {
      const fake = createFilteringFakeClient({
        membership: { ...activeMembership, organizationId: OTHER_ORG },
        permissions: catalog,
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({
        permission: PERMISSION,
        decision: 'deny',
        reason: 'organization-mismatch',
      });
    });

    it('denies when the membership does not belong to the claimed actor (unknown actor)', async () => {
      const fake = createFilteringFakeClient({
        membership: { ...activeMembership, userProfileId: 'someone-else' },
        permissions: catalog,
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({
        permission: PERMISSION,
        decision: 'deny',
        reason: 'actor-mismatch',
      });
    });

    it('denies when the membership status is not active', async () => {
      const fake = createFilteringFakeClient({
        membership: { ...activeMembership, status: 'suspended' },
        permissions: catalog,
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({
        permission: PERMISSION,
        decision: 'deny',
        reason: 'inactive-membership',
      });
    });

    it('denies when the membership has been soft-deleted', async () => {
      const fake = createFilteringFakeClient({
        membership: { ...activeMembership, deletedAt: new Date('2026-01-01T00:00:00.000Z') },
        permissions: catalog,
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({
        permission: PERMISSION,
        decision: 'deny',
        reason: 'inactive-membership',
      });
    });

    it('denies when the permission does not exist in the catalog', async () => {
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
        ],
        permissions: [],
      });
      const engine = createAuthorizationEngine(fake);

      const result = await engine.checkPermission(validInput);

      expect(result).toEqual({
        permission: PERMISSION,
        decision: 'deny',
        reason: 'unknown-permission',
      });
    });
  });

  it('never trusts a caller-supplied role id - resolution always comes from MembershipRole', async () => {
    const fake = createFilteringFakeClient({
      membership: activeMembership,
      membershipRoles: [
        { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
      ],
      permissions: catalog,
      rolePermissions: [
        { organizationId: ORG, roleId: ROLE_A, permissionId: PERMISSION_ROW_ID, effect: 'allow' },
      ],
    });
    const engine = createAuthorizationEngine(fake);

    // CheckPermissionInput has no `roleIds` field at all. Smuggle one in via
    // a loosely-typed cast to prove it has zero effect on the decision - the
    // result must still come entirely from the real MembershipRole lookup.
    const smuggledInput = {
      ...validInput,
      roleIds: ['role-attacker-controls'],
    } as unknown as CheckPermissionInput;

    const result = await engine.checkPermission(smuggledInput);

    expect(result).toEqual({ permission: PERMISSION, decision: 'allow', reason: 'role-allow' });
    expect(fake.membershipRole.findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, organizationMembershipId: MEMBERSHIP },
    });
  });

  describe('database error handling', () => {
    it('propagates a database error from the membership lookup without swallowing or converting it to a deny', async () => {
      const originalError = new Error('connection refused');
      const fake = createFakeClient();
      fake.organizationMembership.findUnique.mockRejectedValue(originalError);
      const engine = createAuthorizationEngine(fake);

      await expect(engine.checkPermission(validInput)).rejects.toBe(originalError);
    });

    it('propagates a database error from the rule lookup without swallowing or converting it to a deny', async () => {
      const originalError = new Error('query timeout');
      const fake = createFilteringFakeClient({
        membership: activeMembership,
        membershipRoles: [
          { organizationId: ORG, organizationMembershipId: MEMBERSHIP, roleId: ROLE_A },
        ],
        permissions: catalog,
      });
      fake.rolePermission.findMany.mockRejectedValue(originalError);
      const engine = createAuthorizationEngine(fake);

      await expect(engine.checkPermission(validInput)).rejects.toBe(originalError);
    });
  });

  it('does not mutate the caller-provided input object', async () => {
    const frozenInput: CheckPermissionInput = Object.freeze({
      organizationId: ORG,
      actor: Object.freeze({ userProfileId: USER, membershipId: MEMBERSHIP }),
      permission: PERMISSION,
    });
    const fake = createFilteringFakeClient({
      membership: activeMembership,
      membershipRoles: [],
      permissions: catalog,
    });
    const engine = createAuthorizationEngine(fake);

    // Object.freeze causes a throw (strict mode) on any write attempt, so
    // reaching this point already proves no mutation occurred.
    await expect(engine.checkPermission(frozenInput)).resolves.toBeDefined();
  });

  describe('resolveEffectivePermission (existing pure resolver, unchanged by P011)', () => {
    it('remains a synchronous, pure, non-authoritative function - not touched or superseded by checkPermission', () => {
      const result = resolveEffectivePermission(PERMISSION, { userId: USER, roleIds: [] }, []);

      expect(result).toEqual({ permission: PERMISSION, decision: 'deny', source: 'default' });
      // No `await`/`.then` needed above: this function never returns a
      // Promise and never touches a database. It is a UI hint only -
      // `checkPermission()` in `checkPermission.ts` is the authoritative
      // server-side engine introduced by P011.
    });
  });
});

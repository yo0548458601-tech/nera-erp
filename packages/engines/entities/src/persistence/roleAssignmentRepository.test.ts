import { describe, expect, it, vi } from 'vitest';
import {
  createRoleAssignmentRepository,
  type RoleAssignmentRepositoryDbClient,
  type RoleAssignmentRecord,
} from './roleAssignmentRepository';
import type { RoleDefinition } from '../roles';

function makeAssignment(overrides: Partial<RoleAssignmentRecord> = {}): RoleAssignmentRecord {
  return {
    id: 'assignment-1',
    organizationId: 'org-1',
    entityId: 'entity-1',
    role: 'donor',
    status: 'active',
    startDate: null,
    endDate: null,
    notes: null,
    moduleProfileRef: null,
    assignedByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    removedAt: null,
    ...overrides,
  };
}

function singleAssignmentRoleDef(allowMultiple: boolean): RoleDefinition {
  return {
    id: 'role-def-donor',
    key: 'donor',
    label: 'תורם',
    description: '',
    applicableEntityTypes: ['person'],
    status: 'active',
    order: 0,
    showInGlobalAddNew: false,
    allowMultipleAssignments: allowMultiple,
    supportsDateRange: true,
    supportsBillingProfile: true,
    requiredPermissions: {},
    linkedCustomFieldDefinitionIds: [],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createFakeClient(
  findManyImpl?: () => Promise<RoleAssignmentRecord[]>
): RoleAssignmentRepositoryDbClient {
  return {
    roleAssignment: {
      create: vi.fn(async ({ data }) => makeAssignment(data as Partial<RoleAssignmentRecord>)),
      findMany: vi.fn(findManyImpl ?? (async () => [])),
      findUnique: vi.fn(async () => makeAssignment()),
      update: vi.fn(async ({ data }) => makeAssignment(data as Partial<RoleAssignmentRecord>)),
    },
  };
}

describe('createRoleAssignmentRepository', () => {
  it('assigns a role when the entity has no existing active assignment of it', async () => {
    const client = createFakeClient(async () => []);
    const repo = createRoleAssignmentRepository(client);

    await repo.assignRole({
      organizationId: 'org-1',
      entityId: 'entity-1',
      role: 'donor',
      assignedByUserId: 'user-1',
      roleDefinition: singleAssignmentRoleDef(false),
    });

    expect(client.roleAssignment.create).toHaveBeenCalled();
  });

  it('rejects assigning a single-assignment role a second time while one is already active', async () => {
    const client = createFakeClient(async () => [makeAssignment()]);
    const repo = createRoleAssignmentRepository(client);

    await expect(
      repo.assignRole({
        organizationId: 'org-1',
        entityId: 'entity-1',
        role: 'donor',
        assignedByUserId: 'user-1',
        roleDefinition: singleAssignmentRoleDef(false),
      })
    ).rejects.toThrow(/does not allow multiple assignments/);
    expect(client.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('allows a second assignment of a role whose definition sets allowMultipleAssignments', async () => {
    const client = createFakeClient(async () => [makeAssignment()]);
    const repo = createRoleAssignmentRepository(client);

    await repo.assignRole({
      organizationId: 'org-1',
      entityId: 'entity-1',
      role: 'donor',
      assignedByUserId: 'user-1',
      roleDefinition: singleAssignmentRoleDef(true),
    });

    expect(client.roleAssignment.create).toHaveBeenCalled();
  });

  it('ignores a removed (removedAt set) assignment when checking for an existing active one', async () => {
    const client = createFakeClient(async () => [
      makeAssignment({ removedAt: new Date('2026-01-02T00:00:00.000Z') }),
    ]);
    const repo = createRoleAssignmentRepository(client);

    await repo.assignRole({
      organizationId: 'org-1',
      entityId: 'entity-1',
      role: 'donor',
      assignedByUserId: 'user-1',
      roleDefinition: singleAssignmentRoleDef(false),
    });

    expect(client.roleAssignment.create).toHaveBeenCalled();
  });

  it('removeRoleAssignment sets removedAt (soft removal), never a hard delete', async () => {
    const client = createFakeClient();
    const repo = createRoleAssignmentRepository(client);

    await repo.removeRoleAssignment('assignment-1', 'org-1');

    expect(client.roleAssignment.update).toHaveBeenCalledWith({
      where: { id: 'assignment-1' },
      data: { removedAt: expect.any(Date) },
    });
  });

  it('removeRoleAssignment rejects a cross-organization removal', async () => {
    const client = createFakeClient();
    client.roleAssignment.findUnique = vi.fn(async () =>
      makeAssignment({ organizationId: 'org-2' })
    );
    const repo = createRoleAssignmentRepository(client);

    await expect(repo.removeRoleAssignment('assignment-1', 'org-1')).rejects.toThrow(
      /does not belong to organization/
    );
    expect(client.roleAssignment.update).not.toHaveBeenCalled();
  });
});

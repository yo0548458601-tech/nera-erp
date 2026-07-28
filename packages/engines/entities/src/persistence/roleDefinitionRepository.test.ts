import { describe, expect, it, vi } from 'vitest';
import {
  createRoleDefinitionRepository,
  type RoleDefinitionRepositoryDbClient,
  type RoleDefinitionRecord,
} from './roleDefinitionRepository';
import type { NewRoleDefinitionInput } from '../roles';

function makeRecord(overrides: Partial<RoleDefinitionRecord> = {}): RoleDefinitionRecord {
  return {
    id: 'role-def-1',
    organizationId: 'org-1',
    key: 'volunteer',
    label: 'מתנדב',
    description: '',
    applicableEntityTypes: ['person'],
    status: 'active',
    order: 0,
    icon: null,
    showInGlobalAddNew: false,
    allowMultipleAssignments: false,
    supportsDateRange: true,
    supportsBillingProfile: false,
    requiredPermissions: {},
    linkedCustomFieldDefinitionIds: [],
    isSystem: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<NewRoleDefinitionInput> = {}): NewRoleDefinitionInput {
  return {
    key: 'volunteer',
    label: 'מתנדב',
    description: '',
    applicableEntityTypes: ['person'],
    showInGlobalAddNew: false,
    allowMultipleAssignments: false,
    supportsDateRange: true,
    supportsBillingProfile: false,
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<RoleDefinitionRepositoryDbClient['roleDefinition']> = {}
): RoleDefinitionRepositoryDbClient {
  return {
    roleDefinition: {
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<RoleDefinitionRecord>)),
      findMany: vi.fn(async () => [makeRecord()]),
      findUnique: vi.fn(async () => makeRecord()),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ data }) => makeRecord(data as Partial<RoleDefinitionRecord>)),
      ...overrides,
    },
  };
}

describe('createRoleDefinitionRepository', () => {
  it('creates a role definition scoped to the organization, never persisting institutionId', async () => {
    const client = createFakeClient();
    const repo = createRoleDefinitionRepository(client);

    await repo.createRoleDefinition('org-1', makeInput({ institutionId: 'inst-1' } as never));

    const call = (client.roleDefinition.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.organizationId).toBe('org-1');
    expect(call.data).not.toHaveProperty('institutionId');
    expect(call.data.isSystem).toBe(false);
  });

  it('rejects creating a role definition with a key that already exists for the organization', async () => {
    const client = createFakeClient({ findFirst: vi.fn(async () => makeRecord()) });
    const repo = createRoleDefinitionRepository(client);

    await expect(repo.createRoleDefinition('org-1', makeInput())).rejects.toThrow(/already exists/);
    expect(client.roleDefinition.create).not.toHaveBeenCalled();
  });

  it('updateRoleDefinition rejects a cross-organization update before calling update', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ organizationId: 'org-2' })),
    });
    const repo = createRoleDefinitionRepository(client);

    await expect(repo.updateRoleDefinition('role-def-1', 'org-1', { label: 'x' })).rejects.toThrow(
      /does not belong to organization/
    );
    expect(client.roleDefinition.update).not.toHaveBeenCalled();
  });

  it('updateRoleDefinition never forwards institutionId even if present on the patch', async () => {
    const client = createFakeClient();
    const repo = createRoleDefinitionRepository(client);

    await repo.updateRoleDefinition('role-def-1', 'org-1', {
      label: 'new label',
      institutionId: 'inst-1',
    });

    const call = (client.roleDefinition.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data).toEqual({ label: 'new label' });
  });

  it('setRoleDefinitionStatus toggles status only after confirming ownership', async () => {
    const client = createFakeClient();
    const repo = createRoleDefinitionRepository(client);

    await repo.setRoleDefinitionStatus('role-def-1', 'org-1', 'inactive');

    expect(client.roleDefinition.update).toHaveBeenCalledWith({
      where: { id: 'role-def-1' },
      data: { status: 'inactive' },
    });
  });

  it('rejects a missing organizationId without touching the database', async () => {
    const client = createFakeClient();
    const repo = createRoleDefinitionRepository(client);

    await expect(repo.listRoleDefinitions('')).rejects.toThrow(/organizationId/);
    expect(client.roleDefinition.findMany).not.toHaveBeenCalled();
  });
});

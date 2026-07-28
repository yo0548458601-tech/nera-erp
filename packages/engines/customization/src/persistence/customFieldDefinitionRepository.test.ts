import { describe, expect, it, vi } from 'vitest';
import {
  createCustomFieldDefinitionRepository,
  type CustomFieldDefinitionRepositoryDbClient,
  type CustomFieldDefinitionRecord,
} from './customFieldDefinitionRepository';
import type { NewCustomFieldInput } from '../customFields';

function makeRecord(
  overrides: Partial<CustomFieldDefinitionRecord> = {}
): CustomFieldDefinitionRecord {
  return {
    id: 'cf-def-1',
    organizationId: 'org-1',
    key: 'shirt_size',
    label: 'מידת חולצה',
    description: null,
    helpText: null,
    fieldType: 'short_text',
    targetScope: 'entity_type',
    targetEntityType: 'person',
    targetRoleKey: null,
    targetModuleId: null,
    required: false,
    defaultValue: null,
    validation: null,
    options: null,
    showInList: false,
    showInDetail: true,
    filterable: false,
    searchable: false,
    includeInExcelExport: true,
    includeInExcelImport: false,
    viewPermission: null,
    editPermission: null,
    order: 0,
    section: null,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<NewCustomFieldInput> = {}): NewCustomFieldInput {
  return {
    key: 'shirt_size',
    label: 'מידת חולצה',
    fieldType: 'short_text',
    targetScope: 'entity_type',
    targetEntityType: 'person',
    required: false,
    showInList: false,
    showInDetail: true,
    filterable: false,
    searchable: false,
    includeInExcelExport: true,
    includeInExcelImport: false,
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<CustomFieldDefinitionRepositoryDbClient['customFieldDefinition']> = {}
): CustomFieldDefinitionRepositoryDbClient {
  return {
    customFieldDefinition: {
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<CustomFieldDefinitionRecord>)),
      findMany: vi.fn(async () => [makeRecord()]),
      findUnique: vi.fn(async () => makeRecord()),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      update: vi.fn(async ({ data }) => makeRecord(data as Partial<CustomFieldDefinitionRecord>)),
      ...overrides,
    },
  };
}

describe('createCustomFieldDefinitionRepository', () => {
  it('creates a definition scoped to the organization, never persisting institutionId', async () => {
    const client = createFakeClient();
    const repo = createCustomFieldDefinitionRepository(client);

    await repo.createCustomFieldDefinition('org-1', makeInput({ institutionId: 'inst-1' }));

    const call = (client.customFieldDefinition.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.organizationId).toBe('org-1');
    expect(call.data).not.toHaveProperty('institutionId');
    expect(call.data.status).toBe('active');
  });

  it('assigns the next display order from the current count for the organization', async () => {
    const client = createFakeClient({ count: vi.fn(async () => 3) });
    const repo = createCustomFieldDefinitionRepository(client);

    await repo.createCustomFieldDefinition('org-1', makeInput());

    const call = (client.customFieldDefinition.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.order).toBe(3);
  });

  it('rejects creating a definition with a key that already exists for the organization', async () => {
    const client = createFakeClient({ findFirst: vi.fn(async () => makeRecord()) });
    const repo = createCustomFieldDefinitionRepository(client);

    await expect(repo.createCustomFieldDefinition('org-1', makeInput())).rejects.toThrow(
      /already exists/
    );
    expect(client.customFieldDefinition.create).not.toHaveBeenCalled();
  });

  it('setCustomFieldDefinitionStatus rejects a cross-organization definition before updating', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ organizationId: 'org-2' })),
    });
    const repo = createCustomFieldDefinitionRepository(client);

    await expect(
      repo.setCustomFieldDefinitionStatus('cf-def-1', 'org-1', 'inactive')
    ).rejects.toThrow(/does not belong to organization/);
    expect(client.customFieldDefinition.update).not.toHaveBeenCalled();
  });

  it('rejects a missing organizationId without touching the database', async () => {
    const client = createFakeClient();
    const repo = createCustomFieldDefinitionRepository(client);

    await expect(repo.listCustomFieldDefinitions('')).rejects.toThrow(/organizationId/);
    expect(client.customFieldDefinition.findMany).not.toHaveBeenCalled();
  });
});

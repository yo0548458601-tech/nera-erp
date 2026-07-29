import { describe, expect, it, vi } from 'vitest';
import {
  createCustomFieldValueRepository,
  type CustomFieldValueRepositoryDbClient,
  type CustomFieldValueRecord,
} from './customFieldValueRepository';

function makeRecord(overrides: Partial<CustomFieldValueRecord> = {}): CustomFieldValueRecord {
  return {
    id: 'cf-val-1',
    organizationId: 'org-1',
    customFieldDefinitionId: 'cf-def-1',
    entityId: 'entity-1',
    value: { type: 'short_text', value: 'M' },
    updatedByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<CustomFieldValueRepositoryDbClient['customFieldValue']> = {}
): CustomFieldValueRepositoryDbClient {
  return {
    customFieldValue: {
      findMany: vi.fn(async () => [makeRecord()]),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<CustomFieldValueRecord>)),
      update: vi.fn(async ({ data }) => makeRecord(data as Partial<CustomFieldValueRecord>)),
      ...overrides,
    },
  };
}

describe('createCustomFieldValueRepository', () => {
  it('setValue creates a new row when no value exists yet for this entity/definition pair', async () => {
    const client = createFakeClient();
    const repo = createCustomFieldValueRepository(client);

    await repo.setValue({
      organizationId: 'org-1',
      entityId: 'entity-1',
      customFieldDefinitionId: 'cf-def-1',
      value: { type: 'short_text', value: 'L' },
      updatedByUserId: 'user-1',
    });

    expect(client.customFieldValue.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        entityId: 'entity-1',
        customFieldDefinitionId: 'cf-def-1',
        value: { type: 'short_text', value: 'L' },
        updatedByUserId: 'user-1',
      },
    });
  });

  it('setValue updates the existing row in place rather than creating a duplicate', async () => {
    const client = createFakeClient({ findFirst: vi.fn(async () => makeRecord()) });
    const repo = createCustomFieldValueRepository(client);

    await repo.setValue({
      organizationId: 'org-1',
      entityId: 'entity-1',
      customFieldDefinitionId: 'cf-def-1',
      value: { type: 'short_text', value: 'XL' },
      updatedByUserId: 'user-2',
    });

    expect(client.customFieldValue.update).toHaveBeenCalledWith({
      where: { id: 'cf-val-1' },
      data: { value: { type: 'short_text', value: 'XL' }, updatedByUserId: 'user-2' },
    });
    expect(client.customFieldValue.create).not.toHaveBeenCalled();
  });

  it('rejects a missing entityId without touching the database', async () => {
    const client = createFakeClient();
    const repo = createCustomFieldValueRepository(client);

    await expect(repo.listValuesForEntity('')).rejects.toThrow(/entityId/);
    expect(client.customFieldValue.findMany).not.toHaveBeenCalled();
  });
});

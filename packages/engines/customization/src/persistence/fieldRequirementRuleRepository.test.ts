import { describe, expect, it, vi } from 'vitest';
import {
  createFieldRequirementRuleRepository,
  type FieldRequirementRuleRepositoryDbClient,
  type FieldRequirementRuleRecord,
} from './fieldRequirementRuleRepository';

function makeRecord(
  overrides: Partial<FieldRequirementRuleRecord> = {}
): FieldRequirementRuleRecord {
  return {
    id: 'field-req-1',
    organizationId: 'org-1',
    fieldKey: 'birthDate',
    scope: 'role',
    targetId: 'student',
    mode: 'required',
    updatedByUserId: 'user-1',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<FieldRequirementRuleRepositoryDbClient['fieldRequirementRule']> = {}
): FieldRequirementRuleRepositoryDbClient {
  return {
    fieldRequirementRule: {
      findMany: vi.fn(async () => [makeRecord()]),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<FieldRequirementRuleRecord>)),
      update: vi.fn(async ({ data }) => makeRecord(data as Partial<FieldRequirementRuleRecord>)),
      ...overrides,
    },
  };
}

describe('createFieldRequirementRuleRepository', () => {
  it('setRule creates a new row when no rule exists yet for this fieldKey/scope/target', async () => {
    const client = createFakeClient();
    const repo = createFieldRequirementRuleRepository(client);

    await repo.setRule({
      organizationId: 'org-1',
      fieldKey: 'birthDate',
      scope: 'role',
      targetId: 'student',
      mode: 'required',
      updatedByUserId: 'user-1',
    });

    expect(client.fieldRequirementRule.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        fieldKey: 'birthDate',
        scope: 'role',
        targetId: 'student',
        mode: 'required',
        updatedByUserId: 'user-1',
      },
    });
  });

  it('setRule updates the existing rule in place rather than creating a duplicate', async () => {
    const client = createFakeClient({ findFirst: vi.fn(async () => makeRecord()) });
    const repo = createFieldRequirementRuleRepository(client);

    await repo.setRule({
      organizationId: 'org-1',
      fieldKey: 'birthDate',
      scope: 'role',
      targetId: 'student',
      mode: 'optional',
      updatedByUserId: 'user-2',
    });

    expect(client.fieldRequirementRule.update).toHaveBeenCalledWith({
      where: { id: 'field-req-1' },
      data: { mode: 'optional', updatedByUserId: 'user-2' },
    });
    expect(client.fieldRequirementRule.create).not.toHaveBeenCalled();
  });

  it('rejects a missing targetId without touching the database', async () => {
    const client = createFakeClient();
    const repo = createFieldRequirementRuleRepository(client);

    await expect(
      repo.setRule({
        organizationId: 'org-1',
        fieldKey: 'birthDate',
        scope: 'role',
        targetId: '',
        mode: 'optional',
        updatedByUserId: 'user-1',
      })
    ).rejects.toThrow(/targetId/);
    expect(client.fieldRequirementRule.create).not.toHaveBeenCalled();
  });
});

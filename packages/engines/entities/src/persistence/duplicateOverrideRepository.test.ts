import { describe, expect, it, vi } from 'vitest';
import {
  createDuplicateOverrideRepository,
  type DuplicateOverrideRepositoryDbClient,
  type DuplicateOverrideRecordRow,
} from './duplicateOverrideRepository';

function makeRecord(
  overrides: Partial<DuplicateOverrideRecordRow> = {}
): DuplicateOverrideRecordRow {
  return {
    id: 'override-1',
    organizationId: 'org-1',
    entityId: 'entity-1',
    matchedEntityIds: ['entity-2'],
    matchReasons: ['idNumber'],
    overrideReason: 'Confirmed different people with a shared ID number typo.',
    decidedByUserId: 'user-1',
    decidedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createFakeClient(): DuplicateOverrideRepositoryDbClient {
  return {
    duplicateOverrideRecord: {
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<DuplicateOverrideRecordRow>)),
      findMany: vi.fn(async () => [makeRecord()]),
    },
  };
}

describe('createDuplicateOverrideRepository', () => {
  it('rejects a missing overrideReason without touching the database', async () => {
    const client = createFakeClient();
    const repo = createDuplicateOverrideRepository(client);

    await expect(
      repo.recordDuplicateOverride({
        organizationId: 'org-1',
        entityId: 'entity-1',
        matchedEntityIds: ['entity-2'],
        matchReasons: ['idNumber'],
        overrideReason: '',
        decidedByUserId: 'user-1',
      })
    ).rejects.toThrow(/overrideReason/);
    expect(client.duplicateOverrideRecord.create).not.toHaveBeenCalled();
  });

  it('records every matched entity id and match reason exactly as given, with no dedupe/merge logic', async () => {
    const client = createFakeClient();
    const repo = createDuplicateOverrideRepository(client);

    await repo.recordDuplicateOverride({
      organizationId: 'org-1',
      entityId: 'entity-1',
      matchedEntityIds: ['entity-2', 'entity-3'],
      matchReasons: ['idNumber', 'phone'],
      overrideReason: 'Verified by phone call.',
      decidedByUserId: 'user-1',
    });

    expect(client.duplicateOverrideRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchedEntityIds: ['entity-2', 'entity-3'],
        matchReasons: ['idNumber', 'phone'],
      }),
    });
  });

  it('allows recording a second override for the same entity - no uniqueness constraint applied', async () => {
    const client = createFakeClient();
    const repo = createDuplicateOverrideRepository(client);

    await repo.recordDuplicateOverride({
      organizationId: 'org-1',
      entityId: 'entity-1',
      matchedEntityIds: ['entity-2'],
      matchReasons: ['phone'],
      overrideReason: 'First override.',
      decidedByUserId: 'user-1',
    });
    await repo.recordDuplicateOverride({
      organizationId: 'org-1',
      entityId: 'entity-1',
      matchedEntityIds: ['entity-2'],
      matchReasons: ['phone'],
      overrideReason: 'Second override, same conflict still present.',
      decidedByUserId: 'user-1',
    });

    expect(client.duplicateOverrideRecord.create).toHaveBeenCalledTimes(2);
  });
});

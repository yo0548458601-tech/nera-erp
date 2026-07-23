import { describe, expect, it, vi } from 'vitest';
import {
  createPersonProfileRepository,
  type PersonProfileRepositoryDbClient,
  type PersonProfileRecord,
} from './personProfileRepository';

function makeRecord(overrides: Partial<PersonProfileRecord> = {}): PersonProfileRecord {
  return {
    entityId: 'entity-1',
    organizationId: 'org-1',
    firstName: 'Yehuda',
    lastName: 'Ozer',
    idNumber: null,
    birthDateGregorian: null,
    hebrewDateAdjustmentDays: 0,
    gender: 'male',
    profileImageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createFakeClient(
  findUniqueImpl?: () => Promise<PersonProfileRecord | null>
): PersonProfileRepositoryDbClient {
  return {
    personProfile: {
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<PersonProfileRecord>)),
      findUnique: vi.fn(findUniqueImpl ?? (async () => makeRecord())),
      update: vi.fn(async ({ data }) => makeRecord(data as Partial<PersonProfileRecord>)),
    },
  };
}

describe('createPersonProfileRepository', () => {
  it('rejects a missing firstName without touching the database', async () => {
    const client = createFakeClient();
    const repo = createPersonProfileRepository(client);

    await expect(
      repo.createPersonProfile({
        entityId: 'entity-1',
        organizationId: 'org-1',
        firstName: '',
        lastName: 'Ozer',
        hebrewDateAdjustmentDays: 0,
        gender: 'male',
      })
    ).rejects.toThrow(/firstName/);
    expect(client.personProfile.create).not.toHaveBeenCalled();
  });

  it('getPersonProfile returns null for a profile belonging to a different organization', async () => {
    const client = createFakeClient(async () => makeRecord({ organizationId: 'org-2' }));
    const repo = createPersonProfileRepository(client);

    await expect(repo.getPersonProfile('entity-1', 'org-1')).resolves.toBeNull();
  });

  it('updatePersonProfile rejects a cross-organization update before calling update', async () => {
    const client = createFakeClient(async () => makeRecord({ organizationId: 'org-2' }));
    const repo = createPersonProfileRepository(client);

    await expect(
      repo.updatePersonProfile({
        entityId: 'entity-1',
        organizationId: 'org-1',
        firstName: 'New',
        lastName: 'Name',
        hebrewDateAdjustmentDays: 0,
        gender: 'male',
      })
    ).rejects.toThrow(/does not belong to organization/);
    expect(client.personProfile.update).not.toHaveBeenCalled();
  });

  it('creates a profile with the exact fields provided, defaulting optional fields to null on the record shape', async () => {
    const client = createFakeClient();
    const repo = createPersonProfileRepository(client);

    await repo.createPersonProfile({
      entityId: 'entity-1',
      organizationId: 'org-1',
      firstName: 'Yehuda',
      lastName: 'Ozer',
      hebrewDateAdjustmentDays: 1,
      gender: 'male',
    });

    expect(client.personProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Yehuda',
        lastName: 'Ozer',
        hebrewDateAdjustmentDays: 1,
        gender: 'male',
      }),
    });
  });
});

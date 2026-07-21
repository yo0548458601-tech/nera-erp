import { describe, expect, it, vi } from 'vitest';
import {
  createEntityRepository,
  type EntityRepositoryDbClient,
  type EntityRecord,
} from './entityRepository';

function makeRecord(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: 'entity-1',
    organizationId: 'org-1',
    neraId: 'NERA-00000100',
    entityType: 'person',
    status: 'active',
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<EntityRepositoryDbClient> = {}
): EntityRepositoryDbClient {
  return {
    entity: {
      create: vi.fn(async ({ data }) => makeRecord({ ...data } as Partial<EntityRecord>)),
      findUnique: vi.fn(async () => makeRecord()),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [makeRecord()]),
      update: vi.fn(async ({ data }) => makeRecord({ ...data } as Partial<EntityRecord>)),
    },
    note: {
      aggregate: vi.fn(async () => ({ _count: { _all: 0 }, _max: { createdAt: null } })),
    },
    ...overrides,
  } as EntityRepositoryDbClient;
}

describe('createEntityRepository', () => {
  it('generates the first Nera ID (NERA-00000100) when no prior entity exists for the organization', async () => {
    const client = createFakeClient();
    const repo = createEntityRepository(client);

    await repo.createEntity({ organizationId: 'org-1', entityType: 'person' });

    expect(client.entity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ neraId: 'NERA-00000100' }) })
    );
  });

  it('increments the Nera ID sequence from the latest entity in the same organization', async () => {
    const client = createFakeClient({
      entity: {
        ...createFakeClient().entity,
        findFirst: vi.fn(async () => ({ neraId: 'NERA-00000154' })),
      },
    });
    const repo = createEntityRepository(client);

    await repo.createEntity({ organizationId: 'org-1', entityType: 'person' });

    expect(client.entity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ neraId: 'NERA-00000155' }) })
    );
  });

  it('rejects a missing organizationId without touching the database', async () => {
    const client = createFakeClient();
    const repo = createEntityRepository(client);

    await expect(repo.createEntity({ organizationId: '', entityType: 'person' })).rejects.toThrow(
      /organizationId/
    );
    expect(client.entity.create).not.toHaveBeenCalled();
  });

  it('getEntityById returns null when the entity belongs to a different organization', async () => {
    const client = createFakeClient({
      entity: {
        ...createFakeClient().entity,
        findUnique: vi.fn(async () => makeRecord({ organizationId: 'org-2' })),
      },
    });
    const repo = createEntityRepository(client);

    await expect(repo.getEntityById('entity-1', 'org-1')).resolves.toBeNull();
  });

  it('updateEntity rejects a cross-organization update before calling update', async () => {
    const client = createFakeClient({
      entity: {
        ...createFakeClient().entity,
        findUnique: vi.fn(async () => makeRecord({ organizationId: 'org-2' })),
      },
    });
    const repo = createEntityRepository(client);

    await expect(
      repo.updateEntity({ id: 'entity-1', organizationId: 'org-1', status: 'inactive' })
    ).rejects.toThrow(/does not belong to organization/);
    expect(client.entity.update).not.toHaveBeenCalled();
  });

  it('archiveEntity sets status to archived only after confirming ownership', async () => {
    const client = createFakeClient();
    const repo = createEntityRepository(client);

    await repo.archiveEntity('entity-1', 'org-1');

    expect(client.entity.update).toHaveBeenCalledWith({
      where: { id: 'entity-1' },
      data: { status: 'archived' },
    });
  });

  it('getNotesMetadata computes count/lastNoteAt live rather than reading a cached column', async () => {
    const client = createFakeClient({
      note: {
        aggregate: vi.fn(async () => ({
          _count: { _all: 3 },
          _max: { createdAt: new Date('2026-02-01T00:00:00.000Z') },
        })),
      },
    });
    const repo = createEntityRepository(client);

    await expect(repo.getNotesMetadata('entity-1')).resolves.toEqual({
      count: 3,
      lastNoteAt: new Date('2026-02-01T00:00:00.000Z'),
    });
  });
});

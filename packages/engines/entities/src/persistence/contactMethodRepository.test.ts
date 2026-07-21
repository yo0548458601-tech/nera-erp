import { describe, expect, it, vi } from 'vitest';
import {
  createContactMethodRepository,
  type ContactMethodRepositoryDbClient,
  type PhoneRecord,
} from './contactMethodRepository';

function makePhone(overrides: Partial<PhoneRecord> = {}): PhoneRecord {
  return {
    id: 'phone-1',
    organizationId: 'org-1',
    entityId: 'entity-1',
    number: '0501234567',
    type: 'mobile',
    label: '',
    isPrimary: false,
    status: 'active',
    notes: null,
    sortOrder: 0,
    verified: false,
    verifiedAt: null,
    verifiedByUserId: null,
    deletedAt: null,
    deletedByUserId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<ContactMethodRepositoryDbClient['phone']> = {}
): ContactMethodRepositoryDbClient {
  const phoneModel = {
    create: vi.fn(async ({ data }: { data: unknown }) => makePhone(data as Partial<PhoneRecord>)),
    findUnique: vi.fn(async () => makePhone()),
    findMany: vi.fn(async () => [makePhone()]),
    update: vi.fn(async ({ data }: { data: unknown }) => makePhone(data as Partial<PhoneRecord>)),
    updateMany: vi.fn(async () => ({ count: 0 })),
    ...overrides,
  };
  return {
    phone: phoneModel,
    email: phoneModel as never,
    address: phoneModel as never,
  } as ContactMethodRepositoryDbClient;
}

describe('createContactMethodRepository - phones', () => {
  it('clears any existing primary phone before adding a new primary phone', async () => {
    const client = createFakeClient();
    const repo = createContactMethodRepository(client);

    await repo.phones.add({
      entityId: 'entity-1',
      organizationId: 'org-1',
      number: '0501111111',
      type: 'mobile',
      isPrimary: true,
    } as never);

    expect(client.phone.updateMany).toHaveBeenCalledWith({
      where: { entityId: 'entity-1', isPrimary: true },
      data: { isPrimary: false },
    });
  });

  it('does not touch other primaries when adding a non-primary phone', async () => {
    const client = createFakeClient();
    const repo = createContactMethodRepository(client);

    await repo.phones.add({
      entityId: 'entity-1',
      organizationId: 'org-1',
      number: '0501111111',
      type: 'mobile',
      isPrimary: false,
    } as never);

    expect(client.phone.updateMany).not.toHaveBeenCalled();
  });

  it('excludes the record itself when clearing other primaries on update', async () => {
    const client = createFakeClient();
    const repo = createContactMethodRepository(client);

    await repo.phones.update('phone-1', 'org-1', { isPrimary: true } as never);

    expect(client.phone.updateMany).toHaveBeenCalledWith({
      where: { entityId: 'entity-1', isPrimary: true, id: { not: 'phone-1' } },
      data: { isPrimary: false },
    });
  });

  it('rejects an update for a phone belonging to a different organization', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makePhone({ organizationId: 'org-2' })),
    });
    const repo = createContactMethodRepository(client);

    await expect(repo.phones.update('phone-1', 'org-1', { label: 'x' } as never)).rejects.toThrow(
      /does not belong to organization/
    );
    expect(client.phone.update).not.toHaveBeenCalled();
  });

  it('remove() sets deletedAt/deletedByUserId (soft delete), never a hard delete', async () => {
    const client = createFakeClient();
    const repo = createContactMethodRepository(client);

    await repo.phones.remove('phone-1', 'org-1', 'user-1');

    expect(client.phone.update).toHaveBeenCalledWith({
      where: { id: 'phone-1' },
      data: { deletedAt: expect.any(Date), deletedByUserId: 'user-1' },
    });
  });

  it('restore() clears deletedAt/deletedByUserId', async () => {
    const client = createFakeClient();
    const repo = createContactMethodRepository(client);

    await repo.phones.restore('phone-1', 'org-1');

    expect(client.phone.update).toHaveBeenCalledWith({
      where: { id: 'phone-1' },
      data: { deletedAt: null, deletedByUserId: null },
    });
  });

  it('deactivate()/reactivate() toggle status without touching isPrimary', async () => {
    const client = createFakeClient();
    const repo = createContactMethodRepository(client);

    await repo.phones.deactivate('phone-1', 'org-1');
    expect(client.phone.update).toHaveBeenCalledWith({
      where: { id: 'phone-1' },
      data: { status: 'inactive' },
    });

    await repo.phones.reactivate('phone-1', 'org-1');
    expect(client.phone.update).toHaveBeenCalledWith({
      where: { id: 'phone-1' },
      data: { status: 'active' },
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  createListViewPreferenceRepository,
  type ListViewPreferenceRepositoryDbClient,
  type ListViewColumnPreferenceRecord,
} from './listViewPreferenceRepository';

function makeRow(
  overrides: Partial<ListViewColumnPreferenceRecord> = {}
): ListViewColumnPreferenceRecord {
  return {
    id: 'pref-1',
    organizationId: 'org-1',
    scope: 'system',
    targetId: null,
    screenId: 'contacts',
    visibleColumnKeys: ['name', 'phone'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createFakeClient(
  findManyImpl?: () => Promise<ListViewColumnPreferenceRecord[]>
): ListViewPreferenceRepositoryDbClient {
  return {
    listViewColumnPreference: {
      findMany: vi.fn(findManyImpl ?? (async () => [])),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => makeRow(data as Partial<ListViewColumnPreferenceRecord>)),
      update: vi.fn(async ({ data }) => makeRow(data as Partial<ListViewColumnPreferenceRecord>)),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

describe('createListViewPreferenceRepository - getEffectivePreference resolution cascade', () => {
  const context = {
    organizationId: 'org-1',
    userId: 'user-1',
    roleIds: ['role-a'],
    institutionId: 'inst-1',
  };
  const builtIn = ['name'];

  it('falls back to the built-in default when no preference row exists at any scope', async () => {
    const client = createFakeClient(async () => []);
    const repo = createListViewPreferenceRepository(client);

    await expect(repo.getEffectivePreference('contacts', context, builtIn)).resolves.toEqual({
      screenId: 'contacts',
      visibleColumnKeys: builtIn,
      source: 'default',
    });
  });

  it('a user-scope row wins over role/institution/system rows', async () => {
    const client = createFakeClient(async () => [
      makeRow({ scope: 'system', visibleColumnKeys: ['a'] }),
      makeRow({ scope: 'institution', targetId: 'inst-1', visibleColumnKeys: ['b'] }),
      makeRow({ scope: 'role', targetId: 'role-a', visibleColumnKeys: ['c'] }),
      makeRow({ scope: 'user', targetId: 'user-1', visibleColumnKeys: ['d'] }),
    ]);
    const repo = createListViewPreferenceRepository(client);

    await expect(repo.getEffectivePreference('contacts', context, builtIn)).resolves.toEqual({
      screenId: 'contacts',
      visibleColumnKeys: ['d'],
      source: 'user',
    });
  });

  it('a role-scope row wins over institution/system when no user row matches', async () => {
    const client = createFakeClient(async () => [
      makeRow({ scope: 'system', visibleColumnKeys: ['a'] }),
      makeRow({ scope: 'institution', targetId: 'inst-1', visibleColumnKeys: ['b'] }),
      makeRow({ scope: 'role', targetId: 'role-a', visibleColumnKeys: ['c'] }),
    ]);
    const repo = createListViewPreferenceRepository(client);

    await expect(repo.getEffectivePreference('contacts', context, builtIn)).resolves.toEqual({
      screenId: 'contacts',
      visibleColumnKeys: ['c'],
      source: 'role',
    });
  });

  it('an institution-scope row wins over system when no user/role row matches', async () => {
    const client = createFakeClient(async () => [
      makeRow({ scope: 'system', visibleColumnKeys: ['a'] }),
      makeRow({ scope: 'institution', targetId: 'inst-1', visibleColumnKeys: ['b'] }),
    ]);
    const repo = createListViewPreferenceRepository(client);

    await expect(repo.getEffectivePreference('contacts', context, builtIn)).resolves.toEqual({
      screenId: 'contacts',
      visibleColumnKeys: ['b'],
      source: 'institution',
    });
  });
});

describe('createListViewPreferenceRepository - setPreference / resetPreference', () => {
  it('setPreference creates a new row when none exists yet for the scope/target/screen', async () => {
    const client = createFakeClient();
    const repo = createListViewPreferenceRepository(client);

    await repo.setPreference({
      organizationId: 'org-1',
      scope: 'user',
      targetId: 'user-1',
      screenId: 'contacts',
      visibleColumnKeys: ['name'],
    });

    expect(client.listViewColumnPreference.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        scope: 'user',
        targetId: 'user-1',
        screenId: 'contacts',
        visibleColumnKeys: ['name'],
      },
    });
  });

  it('setPreference updates the existing row in place when one already exists', async () => {
    const client = createFakeClient();
    client.listViewColumnPreference.findFirst = vi.fn(async () =>
      makeRow({ scope: 'user', targetId: 'user-1' })
    );
    const repo = createListViewPreferenceRepository(client);

    await repo.setPreference({
      organizationId: 'org-1',
      scope: 'user',
      targetId: 'user-1',
      screenId: 'contacts',
      visibleColumnKeys: ['name', 'email'],
    });

    expect(client.listViewColumnPreference.update).toHaveBeenCalledWith({
      where: { id: 'pref-1' },
      data: { visibleColumnKeys: ['name', 'email'] },
    });
    expect(client.listViewColumnPreference.create).not.toHaveBeenCalled();
  });

  it('setPreference requires targetId for every scope except system', async () => {
    const client = createFakeClient();
    const repo = createListViewPreferenceRepository(client);

    await expect(
      repo.setPreference({
        organizationId: 'org-1',
        scope: 'user',
        screenId: 'contacts',
        visibleColumnKeys: ['name'],
      })
    ).rejects.toThrow(/targetId/);
  });

  it('resetPreference deletes the row for that scope/target/screen (reset = delete, not a flag)', async () => {
    const client = createFakeClient();
    const repo = createListViewPreferenceRepository(client);

    await repo.resetPreference({
      organizationId: 'org-1',
      scope: 'user',
      targetId: 'user-1',
      screenId: 'contacts',
    });

    expect(client.listViewColumnPreference.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', scope: 'user', targetId: 'user-1', screenId: 'contacts' },
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  createProviderRegistry,
  type AuthProvider,
  type DatabaseProvider,
  type ProviderSession,
  type StorageProvider,
} from './provider';

/**
 * Throwaway in-memory fakes used only to prove the registry mechanism
 * works. None of these is a real implementation, none is exported from this
 * package, and none is consumed anywhere outside this test file - see
 * ADR-009: no concrete provider is selected or shipped in this sprint.
 */
function createFakeAuthProvider(): AuthProvider {
  const sessions = new Map<string, ProviderSession>();
  return {
    async createSession(userId, organizationId) {
      const session: ProviderSession = {
        userId,
        organizationId,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      sessions.set(`${userId}:${organizationId}`, session);
      return session;
    },
    async getSession(token) {
      return sessions.get(token) ?? null;
    },
    async invalidateSession(token) {
      sessions.delete(token);
    },
  };
}

function createFakeDatabaseProvider(): DatabaseProvider {
  return {
    async isConnected() {
      return true;
    },
    async disconnect() {},
    async runInTransaction(run) {
      return run();
    },
  };
}

function createFakeStorageProvider(): StorageProvider {
  const files = new Map<string, Uint8Array>();
  return {
    async upload(key, content) {
      files.set(key, content);
      return { key, url: `fake://${key}` };
    },
    async getSignedUrl(key) {
      return `fake://${key}?signed=1`;
    },
    async delete(key) {
      files.delete(key);
    },
  };
}

describe('createProviderRegistry', () => {
  it('starts with no providers registered', () => {
    const registry = createProviderRegistry();
    expect(registry.hasProvider('database')).toBe(false);
    expect(registry.getProvider('database')).toBeUndefined();
  });

  it('registers and resolves a provider by kind, independently per registry instance', async () => {
    const registryA = createProviderRegistry();
    const registryB = createProviderRegistry();

    registryA.registerProvider('auth', createFakeAuthProvider());

    expect(registryA.hasProvider('auth')).toBe(true);
    expect(registryB.hasProvider('auth')).toBe(false);

    const auth = registryA.getProvider('auth');
    expect(auth).toBeDefined();
    const session = await auth!.createSession('user-1', 'org-1');
    expect(session.userId).toBe('user-1');
    expect(session.organizationId).toBe('org-1');
  });

  it('supports all three provider kinds independently', async () => {
    const registry = createProviderRegistry();
    registry.registerProvider('database', createFakeDatabaseProvider());
    registry.registerProvider('storage', createFakeStorageProvider());

    expect(await registry.getProvider('database')!.isConnected()).toBe(true);
    const uploaded = await registry
      .getProvider('storage')!
      .upload('a.txt', new Uint8Array([1, 2, 3]), 'text/plain');
    expect(uploaded.key).toBe('a.txt');
  });

  it('DatabaseProvider.runInTransaction runs the callback and returns its result, with no query/tx object exposed', async () => {
    const database = createFakeDatabaseProvider();
    const result = await database.runInTransaction(async () => 'unit-of-work-result');
    expect(result).toBe('unit-of-work-result');
  });

  it('rejects a second registration for the same kind rather than silently replacing it', () => {
    const registry = createProviderRegistry();
    const first = createFakeAuthProvider();
    const second = createFakeAuthProvider();

    registry.registerProvider('auth', first);

    expect(() => registry.registerProvider('auth', second)).toThrow(/already registered/);
    // The original registration must survive a rejected duplicate attempt.
    expect(registry.getProvider('auth')).toBe(first);
  });
});

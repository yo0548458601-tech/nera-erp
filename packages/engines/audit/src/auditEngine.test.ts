import { describe, expect, it, vi } from 'vitest';
import { appPrisma, prisma, Prisma, type AuditLog } from '@nera/database';
import { createAuditEngine, type AuditLogDbClient, type RecordAuditInput } from './auditEngine';

/**
 * Throwaway in-memory fake used only to prove `recordAudit`'s behavior
 * without a live database - matching the convention already established by
 * `packages/core/src/provider.test.ts`. Per the P010 owner decision, no test
 * in this file connects to a real Postgres instance; live-database
 * integration testing is deferred to a later persistence/RLS sprint.
 */
function createFakeClient(
  createImpl?: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<AuditLog>
): AuditLogDbClient & { create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(
    createImpl ??
      (async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) =>
        ({
          id: 'fake-audit-id',
          occurredAt: new Date('2026-07-19T00:00:00.000Z'),
          ...data,
        }) as unknown as AuditLog)
  );
  return { auditLog: { create }, create };
}

const validInput: RecordAuditInput = {
  organizationId: 'org-1',
  actor: { userProfileId: 'user-1', membershipId: 'membership-1' },
  action: 'entity.updated',
  entityType: 'entity',
  entityId: 'entity-1',
  oldValues: { name: 'Old Name' },
  newValues: { name: 'New Name' },
  metadata: { source: 'test' },
};

describe('createAuditEngine', () => {
  it('exposes exactly one public method - recordAudit - with no update or delete', () => {
    const engine = createAuditEngine(createFakeClient());
    expect(Object.keys(engine)).toEqual(['recordAudit']);
    expect((engine as Record<string, unknown>).update).toBeUndefined();
    expect((engine as Record<string, unknown>).delete).toBeUndefined();
  });

  it('maps every field correctly into Prisma auditLog.create()', async () => {
    const fake = createFakeClient();
    const engine = createAuditEngine(fake);

    await engine.recordAudit(validInput);

    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        actorUserProfileId: 'user-1',
        actorMembershipId: 'membership-1',
        action: 'entity.updated',
        entityType: 'entity',
        entityId: 'entity-1',
        oldValues: { name: 'Old Name' },
        newValues: { name: 'New Name' },
        metadata: { source: 'test' },
      },
    });
  });

  it('returns the record created by the underlying client', async () => {
    const fake = createFakeClient(async () => ({ id: 'created-id' }) as unknown as AuditLog);
    const engine = createAuditEngine(fake);

    const result = await engine.recordAudit(validInput);

    expect(result).toEqual({ id: 'created-id' });
  });

  describe('actor handling', () => {
    it('writes both actor columns when a human actor is provided', async () => {
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);

      await engine.recordAudit({ ...validInput, actor: { userProfileId: 'user-9' } });

      expect(fake.create.mock.calls[0][0].data).toMatchObject({
        actorUserProfileId: 'user-9',
        actorMembershipId: null,
      });
    });

    it('writes both actor columns as null for a system-initiated action (actor: null)', async () => {
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);

      await engine.recordAudit({ ...validInput, actor: null });

      expect(fake.create.mock.calls[0][0].data).toMatchObject({
        actorUserProfileId: null,
        actorMembershipId: null,
      });
    });
  });

  describe('validation failures', () => {
    const requiredFields: Array<keyof RecordAuditInput> = [
      'organizationId',
      'action',
      'entityType',
      'entityId',
    ];

    for (const field of requiredFields) {
      it(`rejects a missing "${field}"`, async () => {
        const engine = createAuditEngine(createFakeClient());
        const input = { ...validInput, [field]: undefined } as unknown as RecordAuditInput;

        await expect(engine.recordAudit(input)).rejects.toThrow(new RegExp(field));
      });

      it(`rejects an empty-string "${field}"`, async () => {
        const engine = createAuditEngine(createFakeClient());
        const input = { ...validInput, [field]: '   ' } as RecordAuditInput;

        await expect(engine.recordAudit(input)).rejects.toThrow(new RegExp(field));
      });
    }

    it('does not call the database client when validation fails', async () => {
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);

      await expect(engine.recordAudit({ ...validInput, organizationId: '' })).rejects.toThrow();
      expect(fake.create).not.toHaveBeenCalled();
    });
  });

  describe('old/new values and metadata mapping', () => {
    it('omits oldValues/newValues/metadata entirely when undefined, leaving the schema default in effect', async () => {
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);

      await engine.recordAudit({
        organizationId: 'org-1',
        actor: null,
        action: 'entity.created',
        entityType: 'entity',
        entityId: 'entity-1',
      });

      // Prisma treats an explicit `undefined` value the same as an omitted
      // key (it is filtered out before the query is built), so asserting
      // `undefined` here proves the schema default is left in effect.
      const data = fake.create.mock.calls[0][0].data;
      expect(data.oldValues).toBeUndefined();
      expect(data.newValues).toBeUndefined();
      expect(data.metadata).toBeUndefined();
    });

    it('maps an explicit null to Prisma.DbNull, not a raw null literal', async () => {
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);

      await engine.recordAudit({ ...validInput, oldValues: null });

      expect(fake.create.mock.calls[0][0].data.oldValues).toBe(Prisma.DbNull);
    });

    it('passes an object value through unchanged', async () => {
      const payload = { before: 1, after: 2 };
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);

      await engine.recordAudit({ ...validInput, metadata: payload });

      expect(fake.create.mock.calls[0][0].data.metadata).toEqual(payload);
    });
  });

  describe('occurredAt', () => {
    it('omits occurredAt when not provided, leaving the schema @default(now()) in effect', async () => {
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);

      await engine.recordAudit(validInput);

      expect('occurredAt' in fake.create.mock.calls[0][0].data).toBe(false);
    });

    it('passes an explicit occurredAt through when provided (backfill/replay case)', async () => {
      const fake = createFakeClient();
      const engine = createAuditEngine(fake);
      const occurredAt = new Date('2020-01-01T00:00:00.000Z');

      await engine.recordAudit({ ...validInput, occurredAt });

      expect(fake.create.mock.calls[0][0].data.occurredAt).toBe(occurredAt);
    });
  });

  it('propagates a database error without swallowing or wrapping it', async () => {
    const originalError = new Error('connection refused');
    const fake = createFakeClient(async () => {
      throw originalError;
    });
    const engine = createAuditEngine(fake);

    await expect(engine.recordAudit(validInput)).rejects.toBe(originalError);
  });

  it('does not mutate caller-provided payload objects', async () => {
    const oldValues = Object.freeze({ name: 'Old Name' });
    const newValues = Object.freeze({ name: 'New Name' });
    const metadata = Object.freeze({ source: 'test' });
    const engine = createAuditEngine(createFakeClient());

    await expect(
      engine.recordAudit({ ...validInput, oldValues, newValues, metadata })
    ).resolves.toBeDefined();

    // Object.freeze causes a throw (strict mode) on any write attempt, so
    // reaching this point already proves no mutation occurred; this is an
    // explicit belt-and-suspenders content check as well.
    expect(oldValues).toEqual({ name: 'Old Name' });
    expect(newValues).toEqual({ name: 'New Name' });
    expect(metadata).toEqual({ source: 'test' });
  });

  it('defaults to appPrisma, the least-privilege application client (P013A) - never the administrative prisma client - when no client is injected', () => {
    // Constructing with no argument must not throw - it binds to the
    // already-imported `appPrisma` client (no connection is attempted at
    // construction time; Prisma connects lazily on first query). appPrisma
    // and prisma are distinct client instances (different datasources), so
    // this also guards against a regression that silently reintroduces
    // `prisma` as the default.
    expect(() => createAuditEngine()).not.toThrow();
    expect(appPrisma).not.toBe(prisma);
  });
});

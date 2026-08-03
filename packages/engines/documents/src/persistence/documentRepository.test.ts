import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentRepository,
  type DocumentRepositoryDbClient,
  type DocumentRecord,
} from './documentRepository';
import type { NewDocumentUploadInput } from '../document';

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    status: 'uploading',
    storageKey: 'organizations/org-1/documents/doc-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 1024,
    checksumSha256: 'a'.repeat(64),
    createdByUserId: 'user-1',
    deletedByUserId: null,
    purgedByUserId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    purgedAt: null,
    reconciledAt: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<NewDocumentUploadInput> = {}): NewDocumentUploadInput {
  return {
    organizationId: 'org-1',
    createdByUserId: 'user-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 1024,
    checksumSha256: 'a'.repeat(64),
    storageKey: 'organizations/org-1/documents/doc-1',
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<DocumentRepositoryDbClient['document']> = {}
): DocumentRepositoryDbClient {
  return {
    document: {
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<DocumentRecord>)),
      findUnique: vi.fn(async () => makeRecord()),
      findMany: vi.fn(async () => [makeRecord()]),
      update: vi.fn(async ({ data }) => makeRecord(data as Partial<DocumentRecord>)),
      ...overrides,
    },
  };
}

describe('createDocumentRepository', () => {
  it('creates a document with status "uploading", never accepting a client-supplied status', async () => {
    const client = createFakeClient();
    const repo = createDocumentRepository(client);

    await repo.createUploadingDocument('org-1', makeInput());

    const call = (client.document.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.organizationId).toBe('org-1');
    expect(call.data.status).toBe('uploading');
  });

  it('rejects a missing organizationId without touching the database', async () => {
    const client = createFakeClient();
    const repo = createDocumentRepository(client);

    await expect(repo.createUploadingDocument('', makeInput())).rejects.toThrow(/organizationId/);
    expect(client.document.create).not.toHaveBeenCalled();
  });

  it('markDocumentAvailable rejects a cross-organization document before calling update', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ organizationId: 'org-2' })),
    });
    const repo = createDocumentRepository(client);

    await expect(repo.markDocumentAvailable('doc-1', 'org-1')).rejects.toThrow(
      /does not belong to organization/
    );
    expect(client.document.update).not.toHaveBeenCalled();
  });

  it('softDeleteDocument rejects a document that is not available', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ status: 'uploading' })),
    });
    const repo = createDocumentRepository(client);

    await expect(repo.softDeleteDocument('doc-1', 'org-1', 'user-1')).rejects.toThrow(
      /is not available/
    );
    expect(client.document.update).not.toHaveBeenCalled();
  });

  it('softDeleteDocument sets deletedAt/deletedByUserId on an available document', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ status: 'available' })),
    });
    const repo = createDocumentRepository(client);

    await repo.softDeleteDocument('doc-1', 'org-1', 'user-2');

    const call = (client.document.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.deletedByUserId).toBe('user-2');
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it('restoreDocument rejects a document past its recovery window (already purged)', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () =>
        makeRecord({ deletedAt: new Date('2026-01-01'), purgedAt: new Date('2026-02-01') })
      ),
    });
    const repo = createDocumentRepository(client);

    await expect(repo.restoreDocument('doc-1', 'org-1')).rejects.toThrow(
      /not within its recovery window/
    );
    expect(client.document.update).not.toHaveBeenCalled();
  });

  it('restoreDocument clears deletedAt/deletedByUserId within the recovery window', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () =>
        makeRecord({ deletedAt: new Date('2026-01-01'), deletedByUserId: 'user-1', purgedAt: null })
      ),
    });
    const repo = createDocumentRepository(client);

    await repo.restoreDocument('doc-1', 'org-1');

    expect(client.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { deletedAt: null, deletedByUserId: null },
    });
  });

  it('hardDeleteDocument rejects a document that has already been purged', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ purgedAt: new Date('2026-01-01') })),
    });
    const repo = createDocumentRepository(client);

    await expect(repo.hardDeleteDocument('doc-1', 'org-1', 'admin-1')).rejects.toThrow(
      /already been purged/
    );
    expect(client.document.update).not.toHaveBeenCalled();
  });

  it('hardDeleteDocument sets purgedAt/purgedByUserId, backfilling deletedAt if it was never soft-deleted', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ status: 'available', deletedAt: null })),
    });
    const repo = createDocumentRepository(client);

    await repo.hardDeleteDocument('doc-1', 'org-1', 'admin-1');

    const call = (client.document.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.purgedByUserId).toBe('admin-1');
    expect(call.data.purgedAt).toBeInstanceOf(Date);
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it('findStuckForReconciliation queries across every organization (no organizationId filter)', async () => {
    const client = createFakeClient();
    const repo = createDocumentRepository(client);
    const cutoff = new Date('2026-01-01T01:00:00.000Z');

    await repo.findStuckForReconciliation(cutoff);

    expect(client.document.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['uploading', 'failed'] },
        reconciledAt: null,
        createdAt: { lt: cutoff },
      },
    });
  });

  it('findPurgeEligible queries across every organization for soft-deleted, unpurged rows past the cutoff', async () => {
    const client = createFakeClient();
    const repo = createDocumentRepository(client);
    const cutoff = new Date('2026-01-31T00:00:00.000Z');

    await repo.findPurgeEligible(cutoff);

    expect(client.document.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: { not: null, lt: cutoff },
        purgedAt: null,
      },
    });
  });
});

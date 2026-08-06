import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '@nera/core';
import { runDocumentRetentionPurge } from './retentionPurgeService';
import type { DocumentRepositoryDbClient, DocumentRecord } from '../persistence/documentRepository';

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    status: 'available',
    storageKey: 'organizations/org-1/documents/doc-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 1024,
    checksumSha256: 'x'.repeat(64),
    createdByUserId: 'user-1',
    deletedByUserId: 'user-1',
    purgedByUserId: null,
    createdAt: new Date('2025-11-01T00:00:00.000Z'),
    updatedAt: new Date('2025-12-01T00:00:00.000Z'),
    deletedAt: new Date('2025-12-01T00:00:00.000Z'),
    purgedAt: null,
    reconciledAt: null,
    ...overrides,
  };
}

function createFakeClient(eligibleRecords: DocumentRecord[]): DocumentRepositoryDbClient {
  return {
    document: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(async () => eligibleRecords),
      update: vi.fn(async ({ where, data }) => makeRecord({ id: where.id, ...data })),
    },
  };
}

function createFakeStorageProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    upload: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('runDocumentRetentionPurge', () => {
  it('queries soft-deleted, unpurged rows past the 30-day cutoff, deletes their storage object, and marks them purged with no purgedByUserId', async () => {
    const client = createFakeClient([makeRecord()]);
    const storageProvider = createFakeStorageProvider();
    const now = new Date('2026-01-31T00:00:00.000Z');

    const result = await runDocumentRetentionPurge(
      storageProvider,
      30 * 24 * 60 * 60 * 1000,
      now,
      client
    );

    expect(client.document.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: { not: null, lt: new Date('2026-01-01T00:00:00.000Z') },
        purgedAt: null,
      },
    });
    expect(storageProvider.delete).toHaveBeenCalledWith('organizations/org-1/documents/doc-1');
    expect(client.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { purgedAt: expect.any(Date), purgedByUserId: undefined },
    });
    expect(result.processedDocumentIds).toEqual(['doc-1']);
  });

  it('reports a per-document failure without aborting the rest of the batch', async () => {
    const client = createFakeClient([
      makeRecord({ id: 'doc-1', storageKey: 'organizations/org-1/documents/doc-1' }),
      makeRecord({ id: 'doc-2', storageKey: 'organizations/org-1/documents/doc-2' }),
    ]);
    const storageProvider = createFakeStorageProvider({
      delete: vi.fn(async key => {
        if (key === 'organizations/org-1/documents/doc-2') {
          throw new Error('storage unavailable');
        }
      }),
    });

    const result = await runDocumentRetentionPurge(
      storageProvider,
      30 * 24 * 60 * 60 * 1000,
      new Date(),
      client
    );

    expect(result.processedDocumentIds).toEqual(['doc-1']);
    expect(result.failures).toEqual([{ documentId: 'doc-2', error: 'storage unavailable' }]);
  });
});

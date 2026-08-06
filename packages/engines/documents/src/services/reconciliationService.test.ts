import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '@nera/core';
import { runDocumentReconciliation } from './reconciliationService';
import type { DocumentRepositoryDbClient, DocumentRecord } from '../persistence/documentRepository';

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    status: 'uploading',
    storageKey: 'organizations/org-1/documents/doc-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 1024,
    checksumSha256: 'x'.repeat(64),
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

function createFakeClient(stuckRecords: DocumentRecord[]): DocumentRepositoryDbClient {
  return {
    document: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(async () => stuckRecords),
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

describe('runDocumentReconciliation', () => {
  it('queries stuck rows using the grace-period cutoff, deletes their storage object, and marks them reconciled', async () => {
    const client = createFakeClient([makeRecord({ id: 'doc-1' }), makeRecord({ id: 'doc-2' })]);
    const storageProvider = createFakeStorageProvider();
    const now = new Date('2026-01-01T02:00:00.000Z');

    const result = await runDocumentReconciliation(storageProvider, 60 * 60 * 1000, now, client);

    expect(client.document.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['uploading', 'failed'] },
        reconciledAt: null,
        createdAt: { lt: new Date('2026-01-01T01:00:00.000Z') },
      },
    });
    expect(storageProvider.delete).toHaveBeenCalledTimes(2);
    expect(client.document.update).toHaveBeenCalledTimes(2);
    expect(result.processedDocumentIds).toEqual(['doc-1', 'doc-2']);
    expect(result.failures).toEqual([]);
  });

  it('reports a per-document failure without aborting the rest of the batch', async () => {
    const client = createFakeClient([
      makeRecord({ id: 'doc-1', storageKey: 'organizations/org-1/documents/doc-1' }),
      makeRecord({ id: 'doc-2', storageKey: 'organizations/org-1/documents/doc-2' }),
    ]);
    const storageProvider = createFakeStorageProvider({
      delete: vi.fn(async key => {
        if (key === 'organizations/org-1/documents/doc-1') {
          throw new Error('storage unavailable');
        }
      }),
    });

    const result = await runDocumentReconciliation(
      storageProvider,
      60 * 60 * 1000,
      new Date(),
      client
    );

    expect(result.processedDocumentIds).toEqual(['doc-2']);
    expect(result.failures).toEqual([{ documentId: 'doc-1', error: 'storage unavailable' }]);
  });
});

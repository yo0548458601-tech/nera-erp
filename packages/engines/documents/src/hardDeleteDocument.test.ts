import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '@nera/core';
import type { OrganizationEngine } from '@nera/organization-engine';
import { hardDeleteDocument } from './hardDeleteDocument';
import type { DocumentRepositoryDbClient, DocumentRecord } from './persistence/documentRepository';

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

function createFakeGetOrganizationContext(
  txClient: DocumentRepositoryDbClient
): OrganizationEngine['getOrganizationContext'] {
  return async (_context, work) => work(txClient as never);
}

function createFakeStorageProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return { upload: vi.fn(), getSignedUrl: vi.fn(), delete: vi.fn(async () => {}), ...overrides };
}

describe('hardDeleteDocument', () => {
  it('marks the row purged then physically deletes the storage object, in that order', async () => {
    const calls: string[] = [];
    const txClient: DocumentRepositoryDbClient = {
      document: {
        create: vi.fn(),
        findUnique: vi.fn(async () => makeRecord()),
        findMany: vi.fn(),
        update: vi.fn(async ({ data }) => {
          calls.push('db-update');
          return makeRecord(data as Partial<DocumentRecord>);
        }),
      },
    };
    const storageProvider = createFakeStorageProvider({
      delete: vi.fn(async () => {
        calls.push('storage-delete');
      }),
    });

    const result = await hardDeleteDocument(
      'doc-1',
      'org-1',
      'admin-1',
      storageProvider,
      createFakeGetOrganizationContext(txClient)
    );

    expect(calls).toEqual(['db-update', 'storage-delete']);
    expect(storageProvider.delete).toHaveBeenCalledWith('organizations/org-1/documents/doc-1');
    expect(result.purgedByUserId).toBe('admin-1');
  });

  it('rejects a document that has already been purged, never calling the storage provider', async () => {
    const txClient: DocumentRepositoryDbClient = {
      document: {
        create: vi.fn(),
        findUnique: vi.fn(async () => makeRecord({ purgedAt: new Date('2026-01-01') })),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    const storageProvider = createFakeStorageProvider();

    await expect(
      hardDeleteDocument(
        'doc-1',
        'org-1',
        'admin-1',
        storageProvider,
        createFakeGetOrganizationContext(txClient)
      )
    ).rejects.toThrow(/already been purged/);

    expect(storageProvider.delete).not.toHaveBeenCalled();
  });
});

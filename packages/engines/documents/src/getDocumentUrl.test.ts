import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '@nera/core';
import type { OrganizationEngine } from '@nera/organization-engine';
import { getDocumentUrl, DocumentNotAvailableError } from './getDocumentUrl';
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
  record: DocumentRecord | null
): OrganizationEngine['getOrganizationContext'] {
  const txClient: DocumentRepositoryDbClient = {
    document: {
      create: vi.fn(),
      findUnique: vi.fn(async () => record),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return async (_context, work) => work(txClient as never);
}

function createFakeStorageProvider(): StorageProvider {
  return {
    upload: vi.fn(),
    getSignedUrl: vi.fn(async key => `fake://${key}?signed=1`),
    delete: vi.fn(),
  };
}

describe('getDocumentUrl', () => {
  it('returns a signed URL for an available document owned by the requesting organization', async () => {
    const storageProvider = createFakeStorageProvider();

    const url = await getDocumentUrl(
      'doc-1',
      'org-1',
      storageProvider,
      900,
      createFakeGetOrganizationContext(makeRecord())
    );

    expect(url).toBe('fake://organizations/org-1/documents/doc-1?signed=1');
    expect(storageProvider.getSignedUrl).toHaveBeenCalledWith(
      'organizations/org-1/documents/doc-1',
      900
    );
  });

  it('rejects a document belonging to a different organization', async () => {
    const storageProvider = createFakeStorageProvider();

    await expect(
      getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        900,
        createFakeGetOrganizationContext(makeRecord({ organizationId: 'org-2' }))
      )
    ).rejects.toThrow(DocumentNotAvailableError);
    expect(storageProvider.getSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects a document that is not yet available (still uploading)', async () => {
    const storageProvider = createFakeStorageProvider();

    await expect(
      getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        900,
        createFakeGetOrganizationContext(makeRecord({ status: 'uploading' }))
      )
    ).rejects.toThrow(DocumentNotAvailableError);
  });

  it('rejects a soft-deleted document', async () => {
    const storageProvider = createFakeStorageProvider();

    await expect(
      getDocumentUrl(
        'doc-1',
        'org-1',
        storageProvider,
        900,
        createFakeGetOrganizationContext(makeRecord({ deletedAt: new Date('2026-01-01') }))
      )
    ).rejects.toThrow(DocumentNotAvailableError);
  });

  it('rejects an unknown document id', async () => {
    const storageProvider = createFakeStorageProvider();

    await expect(
      getDocumentUrl(
        'missing',
        'org-1',
        storageProvider,
        900,
        createFakeGetOrganizationContext(null)
      )
    ).rejects.toThrow(DocumentNotAvailableError);
  });
});

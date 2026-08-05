import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '@nera/core';
import type { OrganizationEngine } from '@nera/organization-engine';
import { uploadDocument, DocumentUploadRejectedError } from './uploadDocument';
import type { DocumentRepositoryDbClient, DocumentRecord } from './persistence/documentRepository';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0x00, 0x00]);

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    status: 'uploading',
    storageKey: 'organizations/org-1/documents/doc-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: PDF_BYTES.length,
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

function createFakeTxClient(
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

function createFakeGetOrganizationContext(
  txClient: DocumentRepositoryDbClient
): OrganizationEngine['getOrganizationContext'] {
  return async (_context, work) => work(txClient as never);
}

function createFakeStorageProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    upload: vi.fn(async key => ({ key })),
    getSignedUrl: vi.fn(async key => `fake://${key}`),
    delete: vi.fn(async () => {}),
    ...overrides,
  };
}

const validInput = {
  organizationId: 'org-1',
  createdByUserId: 'user-1',
  filename: 'invoice.pdf',
  declaredContentType: 'application/pdf',
  bytes: PDF_BYTES,
};

describe('uploadDocument', () => {
  it('passes a Hebrew filename to the repository create call unchanged', async () => {
    const txClient = createFakeTxClient();
    const storageProvider = createFakeStorageProvider();

    await uploadDocument(
      { ...validInput, filename: 'חשבונית ספק אברהם (2).pdf' },
      storageProvider,
      createFakeGetOrganizationContext(txClient)
    );

    const createCall = (txClient.document.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.data.originalFilename).toBe('חשבונית ספק אברהם (2).pdf');
  });

  it('rejects a disallowed file type before ever creating a row or calling the storage provider', async () => {
    const txClient = createFakeTxClient();
    const storageProvider = createFakeStorageProvider();

    await expect(
      uploadDocument(
        { ...validInput, filename: 'malware.exe', declaredContentType: 'application/octet-stream' },
        storageProvider,
        createFakeGetOrganizationContext(txClient)
      )
    ).rejects.toThrow(DocumentUploadRejectedError);

    expect(txClient.document.create).not.toHaveBeenCalled();
    expect(storageProvider.upload).not.toHaveBeenCalled();
  });

  it('on success: creates uploading row, uploads to storage, then marks available', async () => {
    const txClient = createFakeTxClient();
    const storageProvider = createFakeStorageProvider();

    const result = await uploadDocument(
      validInput,
      storageProvider,
      createFakeGetOrganizationContext(txClient)
    );

    expect(txClient.document.create).toHaveBeenCalledTimes(1);
    const createCall = (txClient.document.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.data.status).toBe('uploading');

    expect(storageProvider.upload).toHaveBeenCalledTimes(1);
    const [key, bytes, options] = (storageProvider.upload as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(key).toContain('org-1');
    expect(bytes).toBe(PDF_BYTES);
    expect(options.contentType).toBe('application/pdf');
    expect(options.contentDisposition).toContain('attachment');

    expect(txClient.document.update).toHaveBeenCalledTimes(1);
    expect((txClient.document.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toEqual({
      status: 'available',
    });
    expect(result.status).toBe('available');
  });

  it('on storage failure: marks the row failed, attempts a compensating delete, then rethrows', async () => {
    const txClient = createFakeTxClient();
    const uploadError = new Error('network timeout');
    const storageProvider = createFakeStorageProvider({
      upload: vi.fn(async () => {
        throw uploadError;
      }),
    });

    await expect(
      uploadDocument(validInput, storageProvider, createFakeGetOrganizationContext(txClient))
    ).rejects.toBe(uploadError);

    expect(txClient.document.update).toHaveBeenCalledTimes(1);
    expect((txClient.document.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toEqual({
      status: 'failed',
    });
    expect(storageProvider.delete).toHaveBeenCalledTimes(1);
  });

  it('on storage failure where the compensating delete also fails: still rethrows the original upload error', async () => {
    const txClient = createFakeTxClient();
    const uploadError = new Error('network timeout');
    const storageProvider = createFakeStorageProvider({
      upload: vi.fn(async () => {
        throw uploadError;
      }),
      delete: vi.fn(async () => {
        throw new Error('delete also failed');
      }),
    });

    await expect(
      uploadDocument(validInput, storageProvider, createFakeGetOrganizationContext(txClient))
    ).rejects.toBe(uploadError);
  });
});

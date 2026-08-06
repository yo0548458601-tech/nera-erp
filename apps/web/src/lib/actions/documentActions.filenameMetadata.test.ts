import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  engineUploadDocument: vi.fn(),
  createS3StorageProvider: vi.fn(() => ({}) as never),
  loadS3StorageProviderConfigFromEnv: vi.fn(() => ({}) as never),
  requirePermission: vi.fn(async (): Promise<string | null> => null),
  getOrganizationContext: vi.fn(async (_ctx: unknown, work: (tx: unknown) => unknown) => work({})),
  recordAudit: vi.fn(async () => {}),
  eventBusPublish: vi.fn(async () => {}),
}));

vi.mock('@nera/document-engine', async importOriginal => {
  const actual = await importOriginal<typeof import('@nera/document-engine')>();
  return {
    ...actual,
    uploadDocument: mocks.engineUploadDocument,
    createS3StorageProvider: mocks.createS3StorageProvider,
    loadS3StorageProviderConfigFromEnv: mocks.loadS3StorageProviderConfigFromEnv,
  };
});

vi.mock('@nera/organization-engine', () => ({
  createOrganizationEngine: () => ({ getOrganizationContext: mocks.getOrganizationContext }),
}));

vi.mock('@nera/audit-engine', () => ({
  createAuditEngine: () => ({ recordAudit: mocks.recordAudit }),
}));

vi.mock('@nera/event-bus-engine', () => ({
  eventBus: { publish: mocks.eventBusPublish },
}));

vi.mock('./requirePermission', () => ({
  requirePermission: mocks.requirePermission,
}));

// server-only unconditionally throws under plain Node/Vitest (it relies on
// a bundler honoring its package.json "browser" field swap, which Vitest
// does not do) - documentActions.ts imports originalFilenameMetadata.server
// (guarded), so this test mocks that module to re-export the real,
// unguarded .serverCore implementation. This bypasses only the build-time
// client-bundle guard, not the actual decode/resolve logic under test.
vi.mock('./originalFilenameMetadata.server', async () => {
  const core = await import('./originalFilenameMetadata.serverCore');
  return {
    MAX_ENCODED_ORIGINAL_FILENAME_LENGTH: core.MAX_ENCODED_ORIGINAL_FILENAME_LENGTH,
    decodeOriginalFilenameUtf8Base64Url: core.decodeOriginalFilenameUtf8Base64Url,
    resolveOriginalFilenameFromFormData: core.resolveOriginalFilenameFromFormData,
  };
});

import { uploadDocumentAction } from './documentActions';
import {
  encodeOriginalFilenameUtf8Base64Url,
  FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL,
} from './originalFilenameMetadata.shared';
import type { DocumentRecord } from '@nera/document-engine';

/**
 * Isolated action-level regression test for the P014 mojibake defect - no
 * real Postgres, no real SeaweedFS, no DEMO_ORGANIZATION_ID. Repeated runs
 * of this test must never touch the Owner's persistent local dev database
 * (hard-delete retains an audited purged tombstone rather than removing
 * the row - repeatedly running a live test against real demo data would
 * pollute the Owner's manual document list). The separate, real
 * PostgreSQL Unicode round-trip requirement is covered by
 * documentPersistenceRls.test.ts instead.
 */
const CONTROLLED_FILENAME = 'חשבונית ספק אברהם (2).pdf';

/**
 * A deterministic stand-in for a real corrupted File.name, built
 * explicitly from Unicode code points rather than an unclear mojibake
 * literal: U+00D7 U+0097 is exactly Hebrew "ח" (U+05D7)'s two UTF-8 bytes
 * (0xD7 0x97) reinterpreted one byte per code point - the exact defect
 * proven via the P014 six-boundary trace, not an arbitrary string.
 */
const DETERMINISTIC_CORRUPTED_FILENAME =
  String.fromCodePoint(0x00d7, 0x0097, 0x00d7, 0x00a9) + '.pdf';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function formDataWith(fileName: string, encodedMetadata?: string): FormData {
  const formData = new FormData();
  formData.set('file', new File([PDF_BYTES], fileName, { type: 'application/pdf' }));
  if (encodedMetadata !== undefined) {
    formData.set(FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL, encodedMetadata);
  }
  return formData;
}

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    status: 'available',
    storageKey: 'organizations/org-1/documents/doc-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: PDF_BYTES.length,
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

describe('uploadDocumentAction - original filename resolution (isolated, mocked - no real database/storage)', () => {
  beforeEach(() => {
    mocks.engineUploadDocument.mockReset();
    mocks.createS3StorageProvider.mockReset().mockReturnValue({} as never);
    mocks.loadS3StorageProviderConfigFromEnv.mockReset().mockReturnValue({} as never);
    mocks.requirePermission.mockReset().mockResolvedValue(null);
    mocks.getOrganizationContext.mockReset().mockImplementation(async (_ctx, work) => work({}));
    mocks.recordAudit.mockReset();
    mocks.eventBusPublish.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores a corrupted File.name and passes the decoded Hebrew metadata to the Document Engine', async () => {
    mocks.engineUploadDocument.mockResolvedValue(
      makeRecord({ originalFilename: CONTROLLED_FILENAME })
    );

    const formData = formDataWith(
      DETERMINISTIC_CORRUPTED_FILENAME,
      encodeOriginalFilenameUtf8Base64Url(CONTROLLED_FILENAME)
    );

    const result = await uploadDocumentAction('org-1', formData);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.originalFilename).toBe(CONTROLLED_FILENAME);
    expect(mocks.engineUploadDocument).toHaveBeenCalledTimes(1);
    expect(mocks.engineUploadDocument.mock.calls[0][0]).toEqual(
      expect.objectContaining({ filename: CONTROLLED_FILENAME })
    );
    expect(mocks.engineUploadDocument.mock.calls[0][0]).not.toEqual(
      expect.objectContaining({ filename: DETERMINISTIC_CORRUPTED_FILENAME })
    );
  });

  it.each([
    ['missing metadata field', undefined],
    ['malformed Base64URL syntax', 'not!valid@base64url'],
    ['invalid UTF-8 bytes', Buffer.from([0xff, 0xfe]).toString('base64url')],
    ['excessive encoded length', 'A'.repeat(2049)],
  ])(
    'rejects with the controlled Hebrew validation error when metadata is %s - no file read, no engine call, no persistence',
    async (_label, encodedMetadata) => {
      const file = new File([PDF_BYTES], 'irrelevant.pdf', { type: 'application/pdf' });
      const arrayBufferSpy = vi.spyOn(file, 'arrayBuffer');
      const formData = new FormData();
      formData.set('file', file);
      if (encodedMetadata !== undefined) {
        formData.set(FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL, encodedMetadata);
      }

      const result = await uploadDocumentAction('org-1', formData);

      expect(result).toEqual({ ok: false, reason: 'שם הקובץ אינו תקין.' });
      expect(arrayBufferSpy).not.toHaveBeenCalled();
      expect(mocks.engineUploadDocument).not.toHaveBeenCalled();
      expect(mocks.createS3StorageProvider).not.toHaveBeenCalled();
      expect(mocks.loadS3StorageProviderConfigFromEnv).not.toHaveBeenCalled();
      expect(mocks.getOrganizationContext).not.toHaveBeenCalled();
      expect(mocks.recordAudit).not.toHaveBeenCalled();
      expect(mocks.eventBusPublish).not.toHaveBeenCalled();
    }
  );
});

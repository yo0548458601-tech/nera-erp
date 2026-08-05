import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  engineGetDocumentUrl: vi.fn(),
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
    getDocumentUrl: mocks.engineGetDocumentUrl,
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

// Same rationale as documentActions.filenameMetadata.test.ts: server-only
// unconditionally throws under plain Vitest, so this re-exports the real,
// unguarded .serverCore implementation for the module import to succeed.
vi.mock('./originalFilenameMetadata.server', async () => {
  const core = await import('./originalFilenameMetadata.serverCore');
  return {
    MAX_ENCODED_ORIGINAL_FILENAME_LENGTH: core.MAX_ENCODED_ORIGINAL_FILENAME_LENGTH,
    decodeOriginalFilenameUtf8Base64Url: core.decodeOriginalFilenameUtf8Base64Url,
    resolveOriginalFilenameFromFormData: core.resolveOriginalFilenameFromFormData,
  };
});

import { getDocumentUrlAction } from './documentActions';

describe('getDocumentUrlAction - mode runtime validation (isolated, mocked)', () => {
  beforeEach(() => {
    mocks.engineGetDocumentUrl.mockReset();
    mocks.createS3StorageProvider.mockReset().mockReturnValue({} as never);
    mocks.loadS3StorageProviderConfigFromEnv.mockReset().mockReturnValue({} as never);
    mocks.requirePermission.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts "view" and calls the engine exactly once', async () => {
    mocks.engineGetDocumentUrl.mockResolvedValue('fake://signed-url');
    const result = await getDocumentUrlAction('org-1', 'doc-1', 'view');
    expect(result.ok).toBe(true);
    expect(mocks.engineGetDocumentUrl).toHaveBeenCalledTimes(1);
  });

  it('accepts "download" and calls the engine exactly once', async () => {
    mocks.engineGetDocumentUrl.mockResolvedValue('fake://signed-url');
    const result = await getDocumentUrlAction('org-1', 'doc-1', 'download');
    expect(result.ok).toBe(true);
    expect(mocks.engineGetDocumentUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects a forged, non-union runtime value without initializing the storage provider or calling the engine', async () => {
    // Deliberate test cast - simulates a caller bypassing the TypeScript union at runtime.
    const forgedMode = 'delete-everything' as unknown as 'view' | 'download';

    const result = await getDocumentUrlAction('org-1', 'doc-1', forgedMode);

    expect(result.ok).toBe(false);
    expect(mocks.createS3StorageProvider).not.toHaveBeenCalled();
    expect(mocks.loadS3StorageProviderConfigFromEnv).not.toHaveBeenCalled();
    expect(mocks.engineGetDocumentUrl).not.toHaveBeenCalled();
  });

  it.each(['view', 'download'] as const)(
    'denies %s mode when requirePermission returns a denial reason, before any signed URL is issued',
    async mode => {
      mocks.requirePermission.mockResolvedValue('permission-denied-test-reason');

      const result = await getDocumentUrlAction('org-1', 'doc-1', mode);

      expect(result).toEqual({ ok: false, reason: 'permission-denied-test-reason' });
      expect(mocks.engineGetDocumentUrl).not.toHaveBeenCalled();
      expect(mocks.createS3StorageProvider).not.toHaveBeenCalled();
      expect(mocks.loadS3StorageProviderConfigFromEnv).not.toHaveBeenCalled();
    }
  );
});

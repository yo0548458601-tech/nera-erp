// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Document as DocumentDomain } from '@nera/document-engine';

const mocks = vi.hoisted(() => ({
  listDocumentsAction: vi.fn(),
  getDocumentUrlAction: vi.fn(),
  uploadDocumentAction: vi.fn(),
  generateSampleHebrewPdfAction: vi.fn(),
  deleteDocumentAction: vi.fn(),
  restoreDocumentAction: vi.fn(),
  hardDeleteDocumentAction: vi.fn(),
}));

vi.mock('../../lib/actions/documentActions', () => ({
  listDocumentsAction: (...args: unknown[]) => mocks.listDocumentsAction(...args),
  getDocumentUrlAction: (...args: unknown[]) => mocks.getDocumentUrlAction(...args),
  uploadDocumentAction: (...args: unknown[]) => mocks.uploadDocumentAction(...args),
  generateSampleHebrewPdfAction: (...args: unknown[]) => mocks.generateSampleHebrewPdfAction(...args),
  deleteDocumentAction: (...args: unknown[]) => mocks.deleteDocumentAction(...args),
  restoreDocumentAction: (...args: unknown[]) => mocks.restoreDocumentAction(...args),
  hardDeleteDocumentAction: (...args: unknown[]) => mocks.hardDeleteDocumentAction(...args),
}));

vi.mock('../../context/SessionContext', () => ({
  useSession: () => ({ session: { selectedOrganizationId: 'org-1' } }),
}));

vi.mock('../../context/AuthorizationContext', () => ({
  useMyPermission: () => true,
}));

import { DocumentsVerificationPanel } from './DocumentsVerificationPanel';

function makeDoc(overrides: Partial<DocumentDomain> = {}): DocumentDomain {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    status: 'available',
    storageKey: 'organizations/org-1/documents/doc-1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 1024,
    checksumSha256: 'a'.repeat(64),
    createdByUserId: 'user-1',
    deletedByUserId: null,
    purgedByUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    purgedAt: null,
    reconciledAt: null,
    ...overrides,
  } satisfies DocumentDomain;
}

describe('DocumentsVerificationPanel - View/Download', () => {
  beforeEach(() => {
    mocks.listDocumentsAction.mockReset();
    mocks.getDocumentUrlAction.mockReset();
  });

  afterEach(() => {
    // See DocumentPreviewModal.test.tsx's afterEach for why this is required
    // (vitest.config.ts doesn't set test.globals: true, so
    // @testing-library/react's auto-cleanup never registers).
    cleanup();
  });

  it('clicking View opens the in-page modal and never calls window.open', async () => {
    mocks.listDocumentsAction.mockResolvedValue({ ok: true, data: [makeDoc()] });
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const openSpy = vi.spyOn(window, 'open');
    const user = userEvent.setup();

    render(<DocumentsVerificationPanel />);
    await screen.findByText('invoice.pdf');

    await user.click(screen.getByRole('button', { name: 'צפה' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it.each([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ] as const)('does not render a View button for %s - download-only', async contentType => {
    mocks.listDocumentsAction.mockResolvedValue({
      ok: true,
      data: [makeDoc({ contentType, originalFilename: 'contract.docx' })],
    });

    render(<DocumentsVerificationPanel />);
    await screen.findByText('contract.docx');

    expect(screen.queryByRole('button', { name: 'צפה' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הורד' })).toBeInTheDocument();
  });

  it('Download uses an anchor click, not window.open', async () => {
    mocks.listDocumentsAction.mockResolvedValue({ ok: true, data: [makeDoc()] });
    mocks.getDocumentUrlAction.mockResolvedValue({
      ok: true,
      data: { url: 'https://example.test/download', expiresInSeconds: 900 },
    });
    const openSpy = vi.spyOn(window, 'open');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();

    render(<DocumentsVerificationPanel />);
    await screen.findByText('invoice.pdf');

    await user.click(screen.getByRole('button', { name: 'הורד' }));

    await waitFor(() =>
      expect(mocks.getDocumentUrlAction).toHaveBeenCalledWith('org-1', 'doc-1', 'download')
    );
    expect(openSpy).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('disables Download while a request is already pending, preventing a duplicate click', async () => {
    mocks.listDocumentsAction.mockResolvedValue({ ok: true, data: [makeDoc()] });
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<DocumentsVerificationPanel />);
    await screen.findByText('invoice.pdf');

    await user.click(screen.getByRole('button', { name: 'הורד' }));

    expect(screen.getByRole('button', { name: 'הורד' })).toBeDisabled();
    expect(mocks.getDocumentUrlAction).toHaveBeenCalledTimes(1);
  });

  it('repeated View interaction while the first preview request is unresolved does not issue multiple signed-URL requests', async () => {
    mocks.listDocumentsAction.mockResolvedValue({ ok: true, data: [makeDoc()] });
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<DocumentsVerificationPanel />);
    await screen.findByText('invoice.pdf');

    const viewButton = screen.getByRole('button', { name: 'צפה' });
    await user.click(viewButton);
    await screen.findByRole('dialog');
    // The modal now covers the trigger; clicking the same coordinates again
    // reaches the modal, not a second invocation of handleView - the
    // underlying action must still have fired only once.
    await user.click(viewButton).catch(() => undefined);

    expect(mocks.getDocumentUrlAction).toHaveBeenCalledTimes(1);
  });
});

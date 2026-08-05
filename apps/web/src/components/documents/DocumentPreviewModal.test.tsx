// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Document as DocumentDomain } from '@nera/document-engine';

const mocks = vi.hoisted(() => ({
  getDocumentUrlAction: vi.fn(),
}));

vi.mock('../../lib/actions/documentActions', () => ({
  getDocumentUrlAction: (...args: unknown[]) => mocks.getDocumentUrlAction(...args),
}));

import { DocumentPreviewModal, PDF_LOAD_TIMEOUT_MS } from './DocumentPreviewModal';

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

type ModalProps = Parameters<typeof DocumentPreviewModal>[0];

function renderModal(overrides: Partial<ModalProps> = {}) {
  const props: ModalProps = {
    organizationId: 'org-1',
    document: makeDoc(),
    onClose: vi.fn(),
    onDownload: vi.fn(),
    isDownloadPending: false,
    downloadError: '',
    ...overrides,
  };
  return { ...render(<DocumentPreviewModal {...props} />), props };
}

/** Small parent harness for the close/reopen scenario - mounts/unmounts the modal for real, rather than merely rerendering it with new props. */
function PreviewHarness() {
  const [open, setOpen] = useState(true);
  return open ? (
    <DocumentPreviewModal
      organizationId="org-1"
      document={makeDoc()}
      onClose={() => setOpen(false)}
      onDownload={vi.fn()}
      isDownloadPending={false}
      downloadError=""
    />
  ) : (
    <button type="button" onClick={() => setOpen(true)}>
      reopen
    </button>
  );
}

describe('DocumentPreviewModal', () => {
  beforeEach(() => {
    mocks.getDocumentUrlAction.mockReset();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // vitest.config.ts doesn't set test.globals: true, so
    // @testing-library/react's own auto-cleanup (which detects a *global*
    // afterEach) never registers - without this, every render() in this
    // file leaves its DocumentPreviewModal instance mounted, so several
    // instances' focusin listeners (the focus-trap's second layer) end up
    // stacked in the same jsdom document simultaneously, each trying to
    // pull focus back into its own panel whenever any other instance moves
    // focus - an infinite focus-stealing loop between accumulated
    // instances that overflows the call stack.
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows a loading state while the signed URL is being fetched', () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    renderModal();
    expect(screen.getAllByText('טוען תצוגה מקדימה…')[0]).toBeInTheDocument();
  });

  it('renders a PDF iframe with referrerPolicy="no-referrer" on a successful ActionResult', async () => {
    mocks.getDocumentUrlAction.mockResolvedValue({
      ok: true,
      data: { url: 'https://example.test/signed', expiresInSeconds: 900 },
    });
    renderModal({ document: makeDoc({ contentType: 'application/pdf' }) });

    const iframe = await screen.findByTitle('invoice.pdf');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute('referrerPolicy', 'no-referrer');
    expect(iframe).toHaveAttribute('src', 'https://example.test/signed');
  });

  it.each(['image/jpeg', 'image/png'] as const)(
    'renders an img with referrerPolicy="no-referrer" for %s',
    async contentType => {
      mocks.getDocumentUrlAction.mockResolvedValue({
        ok: true,
        data: { url: 'https://example.test/signed-image', expiresInSeconds: 900 },
      });
      renderModal({ document: makeDoc({ contentType, originalFilename: 'photo.jpg' }) });

      const img = await screen.findByAltText('photo.jpg');
      expect(img.tagName).toBe('IMG');
      expect(img).toHaveAttribute('referrerPolicy', 'no-referrer');
    }
  );

  it('shows the ActionResult failure reason and no broken preview element', async () => {
    mocks.getDocumentUrlAction.mockResolvedValue({ ok: false, reason: 'שגיאת הרשאה מבוקרת' });
    renderModal();

    expect(await screen.findByText('שגיאת הרשאה מבוקרת')).toBeInTheDocument();
    expect(screen.queryByTitle('invoice.pdf')).not.toBeInTheDocument();
  });

  it('stops loading and shows a Hebrew error on a thrown/network failure, without exposing the error itself', async () => {
    mocks.getDocumentUrlAction.mockRejectedValue(new Error('ECONNRESET: internal detail'));
    renderModal();

    await waitFor(() => {
      expect(screen.queryAllByText('טוען תצוגה מקדימה…')).toHaveLength(0);
    });
    expect(screen.getByText('אירעה שגיאה בטעינת התצוגה המקדימה. נסה שוב.')).toBeInTheDocument();
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
  });

  it('shows a controlled preview error when the image fails to load (fireEvent.error)', async () => {
    mocks.getDocumentUrlAction.mockResolvedValue({
      ok: true,
      data: { url: 'https://example.test/broken-image', expiresInSeconds: 900 },
    });
    renderModal({ document: makeDoc({ contentType: 'image/png', originalFilename: 'broken.png' }) });

    const img = await screen.findByAltText('broken.png');
    fireEvent.error(img);

    expect(await screen.findByText('לא ניתן לטעון את התצוגה המקדימה של הקובץ.')).toBeInTheDocument();
  });

  it('the PDF preview falls back to a controlled Hebrew message and keeps Download available if onLoad never fires', () => {
    vi.useFakeTimers();
    mocks.getDocumentUrlAction.mockResolvedValue({
      ok: true,
      data: { url: 'https://example.test/signed', expiresInSeconds: 900 },
    });
    renderModal();

    // The mount effect calls getDocumentUrlAction synchronously (before its
    // first `await`), and render() runs inside act(), so the call has
    // already happened by the time renderModal() returns - waitFor() would
    // poll via a real setTimeout, which never fires once fake timers are
    // active, hanging until the test's own real-time timeout.
    expect(mocks.getDocumentUrlAction).toHaveBeenCalledTimes(1);

    return (async () => {
      // Flush the resolved promise into state before advancing the timeout.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(PDF_LOAD_TIMEOUT_MS);

      expect(
        screen.getByText('לא ניתן לאשר שהתצוגה המקדימה נטענה. ניתן להוריד את הקובץ במקום.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'הורד' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'הורד' })).not.toBeDisabled();
    })();
  });

  it('closes via the close button', async () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.click(screen.getByRole('button', { name: 'סגור' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via Escape', async () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via a backdrop click (outside the panel)', async () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    const dialog = screen.getByRole('dialog');
    await user.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks background scroll while open and restores the previous value on close', () => {
    document.body.style.overflow = 'auto';
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderModal();

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('focuses a sensible control on open and restores focus to the triggering element on unmount', async () => {
    mocks.getDocumentUrlAction.mockResolvedValue({
      ok: true,
      data: { url: 'https://example.test/signed', expiresInSeconds: 900 },
    });
    const trigger = document.createElement('button');
    trigger.textContent = 'צפה';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderModal();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'סגור' }));
    });

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('Tab from the final enabled control cycles to the first control', async () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderModal();

    const downloadButton = screen.getByRole('button', { name: 'הורד' });
    const closeButton = screen.getByRole('button', { name: 'סגור' });
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    await user.tab();
    expect(document.activeElement).toBe(downloadButton);
  });

  it('Shift+Tab from the first control cycles to the final enabled control', async () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderModal();

    const downloadButton = screen.getByRole('button', { name: 'הורד' });
    downloadButton.focus();
    expect(document.activeElement).toBe(downloadButton);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'סגור' }));
  });

  it('programmatically moving focus outside the modal causes focus to return inside', async () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    renderModal();

    const outsider = document.createElement('button');
    outsider.textContent = 'outsider';
    document.body.appendChild(outsider);

    outsider.focus();

    await waitFor(() => {
      expect(document.activeElement).not.toBe(outsider);
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });

    outsider.remove();
  });

  it('clears the URL and issues a fresh request when switching to a different document (rerender)', async () => {
    mocks.getDocumentUrlAction.mockResolvedValueOnce({
      ok: true,
      data: { url: 'https://example.test/first', expiresInSeconds: 900 },
    });
    const { rerender } = renderModal({ document: makeDoc({ id: 'doc-1' }) });
    await screen.findByTitle('invoice.pdf');
    expect(mocks.getDocumentUrlAction).toHaveBeenCalledTimes(1);

    mocks.getDocumentUrlAction.mockResolvedValueOnce({
      ok: true,
      data: { url: 'https://example.test/second', expiresInSeconds: 900 },
    });
    rerender(
      <DocumentPreviewModal
        organizationId="org-1"
        document={makeDoc({ id: 'doc-2', originalFilename: 'second.pdf' })}
        onClose={vi.fn()}
        onDownload={vi.fn()}
        isDownloadPending={false}
        downloadError=""
      />
    );

    await waitFor(() => expect(mocks.getDocumentUrlAction).toHaveBeenCalledTimes(2));
    const iframe = await screen.findByTitle('second.pdf');
    expect(iframe).toHaveAttribute('src', 'https://example.test/second');
  });

  it('close then reopen (real unmount/remount) issues a fresh request and does not reuse the previous URL/error/loading state', async () => {
    mocks.getDocumentUrlAction
      .mockResolvedValueOnce({
        ok: true,
        data: { url: 'https://example.test/first', expiresInSeconds: 900 },
      })
      .mockResolvedValueOnce({ ok: false, reason: 'שגיאה בניסיון השני' });

    const user = userEvent.setup();
    render(<PreviewHarness />);

    await screen.findByTitle('invoice.pdf');
    expect(mocks.getDocumentUrlAction).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'סגור' }));
    const reopenButton = await screen.findByRole('button', { name: 'reopen' });

    await user.click(reopenButton);

    await waitFor(() => expect(mocks.getDocumentUrlAction).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('שגיאה בניסיון השני')).toBeInTheDocument();
    expect(screen.queryByTitle('invoice.pdf')).not.toBeInTheDocument();
  });

  it('disables the Download button while a download is pending', () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    renderModal({ isDownloadPending: true });
    expect(screen.getByRole('button', { name: 'הורד' })).toBeDisabled();
  });

  it('shows a download error inside the modal without closing it', () => {
    mocks.getDocumentUrlAction.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    renderModal({ onClose, downloadError: 'שגיאת רשת מבוקרת בהורדה' });

    expect(screen.getByText('שגיאת רשת מבוקרת בהורדה')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

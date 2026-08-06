'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Document as DocumentDomain } from '@nera/document-engine';
import { getDocumentUrlAction } from '../../lib/actions/documentActions';

type DocumentPreviewModalProps = {
  organizationId: string;
  document: DocumentDomain;
  onClose: () => void;
  onDownload: (documentId: string) => void;
  isDownloadPending: boolean;
  downloadError: string;
};

/** How long to wait for a PDF iframe's onLoad before giving up - cross-origin iframes have no reliable failure signal (a blocked/failed load may never fire an event at all), so this is a best-effort timeout, not genuine load-failure detection. Exported so tests can advance fake timers by the exact value. */
export const PDF_LOAD_TIMEOUT_MS = 15000;

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );
}

/**
 * In-page preview for PDF/JPEG/PNG (P014 Owner requirement - supersedes an
 * earlier new-tab implementation; no window.open anywhere in this
 * component). Fetches its own short-lived "view" signed URL on open
 * (inline Content-Disposition, never a download) and re-fetches whenever a
 * different document is opened - the URL lives only in component state,
 * never persisted, and is cleared on close/switch.
 *
 * useDismissableOverlay (see DocumentsVerificationPanel.tsx's other use of
 * it) provides outside-click and Escape dismissal, but neither a focus
 * trap nor restore-focus on every dismissal path (only on Escape) - it is
 * not reused here for that reason. The focus trap, initial focus, and
 * unconditional restore-focus-on-unmount below are implemented directly,
 * narrowly scoped to this component, rather than changing the shared
 * hook's behavior for its other consumer (PersonFormDialog.tsx).
 */
export function DocumentPreviewModal({
  organizationId,
  document: doc,
  onClose,
  onDownload,
  isDownloadPending,
  downloadError,
}: DocumentPreviewModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const [url, setUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(true);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');

  const isImage = doc.contentType === 'image/jpeg' || doc.contentType === 'image/png';
  const isPdf = doc.contentType === 'application/pdf';

  // Background scroll lock - restores the exact previous value (not
  // unconditionally 'visible'), so an already-locked ancestor state is
  // never clobbered.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Captures the triggering element before anything else in this component
  // moves focus - this must run before the initial-focus effect below, or
  // it would capture the modal's own close button instead of whatever was
  // focused when the modal opened. Also the second, independent layer of
  // the focus trap: catches focus arriving from anywhere other than
  // Tab/Shift+Tab navigation (a programmatic .focus() call, a pointer
  // interaction with a background element that happens to be focusable,
  // etc.) and pulls it back inside. Merged into one effect with
  // restore-focus-on-unmount so listener removal and the restore .focus()
  // call are two sequential statements in one cleanup function - never
  // split across two effects whose relative cleanup order would otherwise
  // be unspecified.
  useEffect(() => {
    triggerElementRef.current = document.activeElement as HTMLElement | null;

    const handleFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target;
      if (target instanceof Node && !panel.contains(target)) {
        const focusable = getFocusableElements(panel);
        (focusable[0] ?? closeButtonRef.current)?.focus();
      }
    };
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      triggerElementRef.current?.focus();
    };
  }, []);

  // Initial focus on a sensible, always-present control.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Narrowly-scoped focus trap - Tab/Shift+Tab cycle within the panel only.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', handleKeyDown);
    return () => panel.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Escape dismissal - implemented locally so close always runs through
  // the single onClose path this component controls end to end.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPreviewUrl(): Promise<void> {
      setUrl(null);
      setFetchError('');
      setIsFetchingUrl(true);
      setIsPreviewLoading(true);
      setPreviewError('');

      try {
        const result = await getDocumentUrlAction(organizationId, doc.id, 'view');
        if (cancelled) return;
        if (!result.ok) {
          setFetchError(result.reason);
          return;
        }
        setUrl(result.data.url);
      } catch {
        if (!cancelled) {
          setFetchError('אירעה שגיאה בטעינת התצוגה המקדימה. נסה שוב.');
        }
      } finally {
        if (!cancelled) {
          setIsFetchingUrl(false);
        }
      }
    }

    void fetchPreviewUrl();

    return () => {
      cancelled = true;
    };
  }, [organizationId, doc.id]);

  // Best-effort fallback for a PDF iframe that never fires onLoad (see
  // PDF_LOAD_TIMEOUT_MS's doc comment on why this can't be detected
  // reliably cross-origin).
  useEffect(() => {
    if (!url || !isPdf) return;
    const timeout = setTimeout(() => {
      setIsPreviewLoading(loading => {
        if (loading) {
          setPreviewError('לא ניתן לאשר שהתצוגה המקדימה נטענה. ניתן להוריד את הקובץ במקום.');
        }
        return false;
      });
    }, PDF_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [url, isPdf]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`תצוגה מקדימה: ${doc.originalFilename}`}
        className="flex h-[92vh] w-[94vw] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="truncate text-lg font-semibold text-slate-900">{doc.originalFilename}</h3>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(doc.id)}
              disabled={isDownloadPending}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
            >
              הורד
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
            >
              סגור
            </button>
          </div>
        </div>

        {downloadError ? (
          <p className="border-b border-slate-100 px-6 py-2 text-sm text-red-600">
            {downloadError}
          </p>
        ) : null}

        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
          {isFetchingUrl ? (
            <p className="text-sm text-slate-500">טוען תצוגה מקדימה…</p>
          ) : fetchError ? (
            <p className="text-sm text-red-600">{fetchError}</p>
          ) : !url ? null : (
            <div className="relative h-full w-full">
              {isPreviewLoading && !previewError ? (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                  טוען תצוגה מקדימה…
                </p>
              ) : null}
              {previewError ? (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-red-600">
                  {previewError}
                </p>
              ) : isPdf ? (
                <iframe
                  src={url}
                  title={doc.originalFilename}
                  referrerPolicy="no-referrer"
                  onLoad={() => setIsPreviewLoading(false)}
                  className="h-full w-full rounded-2xl border border-slate-200 bg-white"
                />
              ) : isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL is not a static/optimizable asset Next's Image component can handle.
                <img
                  src={url}
                  alt={doc.originalFilename}
                  referrerPolicy="no-referrer"
                  onLoad={() => setIsPreviewLoading(false)}
                  onError={() => {
                    setIsPreviewLoading(false);
                    setPreviewError('לא ניתן לטעון את התצוגה המקדימה של הקובץ.');
                  }}
                  className="mx-auto max-h-full max-w-full rounded-2xl object-contain"
                />
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  לא ניתן להציג תצוגה מקדימה עבור סוג קובץ זה.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

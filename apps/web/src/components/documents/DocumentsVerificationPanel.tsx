'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Document as DocumentDomain } from '@nera/document-engine';
import { useSession } from '../../context/SessionContext';
import { useMyPermission } from '../../context/AuthorizationContext';
import { PanelCard } from '../PanelCard';
import {
  deleteDocumentAction,
  generateSampleHebrewPdfAction,
  getDocumentUrlAction,
  hardDeleteDocumentAction,
  listDocumentsAction,
  restoreDocumentAction,
  uploadDocumentAction,
} from '../../lib/actions/documentActions';

const STATUS_LABELS: Record<DocumentDomain['status'], string> = {
  uploading: 'בתהליך העלאה',
  available: 'זמין',
  failed: 'העלאה נכשלה',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * P014 verification surface (not a real business feature): exercises every
 * Document Engine Server Action end-to-end in a real browser, since no real
 * business module (Suppliers/Purchase Orders/Invoices) exists yet to
 * naturally trigger them. Deliberately minimal - local state, no Context -
 * proportionate to a verification tool, not a polished permanent screen.
 */
export function DocumentsVerificationPanel() {
  const { session } = useSession();
  const organizationId = session?.selectedOrganizationId;
  const canUpload = useMyPermission('documents.upload');

  const [documents, setDocuments] = useState<DocumentDomain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    const result = await listDocumentsAction(organizationId);
    if (result.ok) {
      setDocuments([...result.data].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    }
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('בחר קובץ להעלאה.');
      return;
    }

    setError('');
    setMessage('');
    setIsBusy(true);
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadDocumentAction(organizationId, formData);
    setIsBusy(false);

    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setMessage(`הקובץ "${result.data.originalFilename}" הועלה בהצלחה.`);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await refresh();
  };

  const handleGenerateSample = async () => {
    if (!organizationId) return;
    setError('');
    setMessage('');
    setIsBusy(true);
    const result = await generateSampleHebrewPdfAction(organizationId);
    setIsBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setMessage('חשבונית לדוגמה (PDF בעברית, מרובת עמודים) נוצרה והועלתה בהצלחה.');
    await refresh();
  };

  const handleOpenLink = async (documentId: string) => {
    if (!organizationId) return;
    setError('');
    const result = await getDocumentUrlAction(organizationId, documentId);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    window.open(result.data.url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (documentId: string) => {
    if (!organizationId) return;
    setError('');
    const result = await deleteDocumentAction(organizationId, documentId);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    await refresh();
  };

  const handleRestore = async (documentId: string) => {
    if (!organizationId) return;
    setError('');
    const result = await restoreDocumentAction(organizationId, documentId);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    await refresh();
  };

  const handleHardDelete = async (documentId: string, filename: string) => {
    if (!organizationId) return;
    const confirmed = window.confirm(
      `פעולה זו תמחק את הקובץ "${filename}" לצמיתות, כולל מהאחסון. הפעולה בלתי הפיכה ולא ניתנת לשחזור. להמשיך?`
    );
    if (!confirmed) return;

    setError('');
    const result = await hardDeleteDocumentAction(organizationId, documentId);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    await refresh();
  };

  if (!canUpload) {
    return (
      <PanelCard title="מסמכים (מסך אימות P014)">
        <p className="text-sm text-slate-500">אין לך הרשאה להעלות מסמכים.</p>
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="מסמכים (מסך אימות P014)"
      subtitle="מסך אימות למנוע המסמכים - העלאה, הורדה, מחיקה רכה/שחזור ומחיקה סופית על ידי מנהל."
    >
      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
          className="text-sm"
        />
        <button
          type="submit"
          disabled={isBusy || !organizationId}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          העלה קובץ
        </button>
        <button
          type="button"
          onClick={handleGenerateSample}
          disabled={isBusy || !organizationId}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          צור חשבונית לדוגמה (PDF בעברית, מרובת עמודים)
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-slate-500">
              <th className="py-2 pe-4">שם קובץ</th>
              <th className="py-2 pe-4">סטטוס</th>
              <th className="py-2 pe-4">גודל</th>
              <th className="py-2 pe-4">מצב מחיקה</th>
              <th className="py-2 pe-4">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-4 text-slate-500">
                  טוען…
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-slate-500">
                  אין מסמכים עדיין.
                </td>
              </tr>
            ) : (
              documents.map(doc => {
                const isPurged = Boolean(doc.purgedAt);
                const isDeleted = Boolean(doc.deletedAt) && !isPurged;
                const isActive = doc.status === 'available' && !doc.deletedAt;
                return (
                  <tr key={doc.id} className="border-b border-slate-100">
                    <td className="py-2 pe-4">{doc.originalFilename}</td>
                    <td className="py-2 pe-4">{STATUS_LABELS[doc.status]}</td>
                    <td className="py-2 pe-4">{formatBytes(doc.fileSizeBytes)}</td>
                    <td className="py-2 pe-4">
                      {isPurged ? 'נמחק לצמיתות' : isDeleted ? 'נמחק (ניתן לשחזור)' : 'פעיל'}
                    </td>
                    <td className="py-2 pe-4">
                      <div className="flex flex-wrap gap-2">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => handleOpenLink(doc.id)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            פתח קישור
                          </button>
                        ) : null}
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            מחק
                          </button>
                        ) : null}
                        {isDeleted ? (
                          <button
                            type="button"
                            onClick={() => handleRestore(doc.id)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            שחזר
                          </button>
                        ) : null}
                        {!isPurged ? (
                          <button
                            type="button"
                            onClick={() => handleHardDelete(doc.id, doc.originalFilename)}
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                          >
                            מחיקה סופית (מנהל)
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}

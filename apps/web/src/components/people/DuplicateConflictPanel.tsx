'use client';

import { useState } from 'react';
import {
  getEntityDisplayName,
  type DuplicateMatch,
  type DuplicateMatchReason,
} from '@nera/entity-engine';

const reasonLabels: Record<DuplicateMatchReason, string> = {
  idNumber: 'מספר זהות',
  registrationNumber: 'מספר רישום',
  phone: 'טלפון',
  email: 'דוא"ל',
  similarName: 'שם דומה',
};

type DuplicateConflictPanelProps = {
  matches: DuplicateMatch[];
  /** Whether the current user holds entities.duplicate_override. */
  canOverride: boolean;
  onOpenExisting: (entityId: string) => void;
  onConfirmOverride: (reason: string) => void;
};

/**
 * High-severity conflict resolution UI for an exact identifier match
 * (ID number / registration number). The system never decides on its own
 * that two records are the same entity and never merges automatically -
 * this panel exists so a deliberate, permission-checked human decision is
 * always required before a duplicate identifier is allowed to exist.
 */
export function DuplicateConflictPanel({
  matches,
  canOverride,
  onOpenExisting,
  onConfirmOverride,
}: DuplicateConflictPanelProps) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      setReasonError('יש לפרט את הסיבה לשמירת הרשומות בנפרד.');
      return;
    }
    onConfirmOverride(reason.trim());
  };

  return (
    <div
      role="alert"
      className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-900"
    >
      <p className="font-semibold">נמצאה התאמה מדויקת עם רשומה קיימת</p>
      <p className="mt-1 text-rose-800">
        המערכת לעולם לא ממזגת רשומות באופן אוטומטי - יש לבחור כיצד להמשיך:
      </p>

      <ul className="mt-3 space-y-2">
        {matches.map(match => (
          <li key={match.entity.id} className="rounded-xl border border-rose-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">
                  {getEntityDisplayName(match.entity)}{' '}
                  <span className="font-normal text-slate-500">({match.entity.neraId})</span>
                </p>
                <p className="text-xs text-rose-700">
                  התאמה לפי {match.reasons.map(entry => reasonLabels[entry]).join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenExisting(match.entity.id)}
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                פתח רשומה קיימת
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled
        title="יכולת השוואה ומיזוג תתווסף בעתיד"
        className="mt-3 cursor-not-allowed rounded-xl border border-rose-300 bg-white/60 px-3 py-1.5 text-xs font-medium text-rose-700 opacity-70"
      >
        השוואה ומיזוג רשומות (יתווסף בעתיד)
      </button>

      <div className="mt-4 border-t border-rose-200 pt-3">
        {!canOverride ? (
          <p className="text-xs text-rose-700">
            אין לך הרשאה לאשר יצירת רשומה נפרדת חרף ההתאמה. פנה/י למנהל מערכת.
          </p>
        ) : !showOverrideForm ? (
          <button
            type="button"
            onClick={() => setShowOverrideForm(true)}
            className="text-xs font-semibold text-rose-800 underline"
          >
            שמירה בנפרד בכל זאת (דורש הרשאה וסיבה מתועדת)
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-rose-800">
              סיבה לשמירה כרשומה נפרדת *
              <textarea
                value={reason}
                onChange={event => {
                  setReason(event.target.value);
                  setReasonError('');
                }}
                rows={2}
                className="mt-1 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
              />
            </label>
            {reasonError ? <p className="text-xs text-rose-700">{reasonError}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                אשר יצירת רשומה נפרדת
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverrideForm(false);
                  setReason('');
                  setReasonError('');
                }}
                className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs text-rose-700"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

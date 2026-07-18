'use client';

import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { computeHebrewBirthDate, type HebrewDateAdjustment } from '../../lib/dates/hebrewBirthDate';

type HebrewBirthDateFieldProps = {
  birthDateGregorian: string;
  adjustmentDays: HebrewDateAdjustment;
  onAdjustmentChange: (value: HebrewDateAdjustment) => void;
};

/**
 * Read-only computed Hebrew date (always derived from the Gregorian date
 * via the Calendar Engine - never freely editable) plus the -1/0/+1 day
 * adjustment controls. Shown in both the create/edit form and reusable
 * anywhere else a person's Hebrew birth date needs to be shown alongside
 * its adjustment.
 */
export function HebrewBirthDateField({ birthDateGregorian, adjustmentDays, onAdjustmentChange }: HebrewBirthDateFieldProps) {
  if (!birthDateGregorian) {
    return null;
  }

  const hebrewDate = computeHebrewBirthDate(birthDateGregorian, adjustmentDays);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-700">תאריך לידה עברי (מחושב)</span>
        <span dir="rtl" className="text-base font-semibold text-slate-900">
          {hebrewDate.display}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAdjustmentChange(adjustmentDays > -1 ? ((adjustmentDays - 1) as HebrewDateAdjustment) : adjustmentDays)}
          disabled={adjustmentDays <= -1}
          aria-label="הזז יום אחורה"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onAdjustmentChange(0)}
          disabled={adjustmentDays === 0}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40"
        >
          <RotateCcw size={12} aria-hidden="true" />
          איפוס
        </button>
        <button
          type="button"
          onClick={() => onAdjustmentChange(adjustmentDays < 1 ? ((adjustmentDays + 1) as HebrewDateAdjustment) : adjustmentDays)}
          disabled={adjustmentDays >= 1}
          aria-label="הזז יום קדימה"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span className="text-xs text-slate-500">
          {adjustmentDays === 0 ? 'ללא תיקון' : adjustmentDays > 0 ? `תוקן יום אחד קדימה` : `תוקן יום אחד אחורה`}
        </span>
      </div>

      <p className="text-xs text-slate-400">
        התאריך העברי מחושב אוטומטית מהתאריך הלועזי. אם קיים חוסר ודאות לגבי התאריך העברי המדויק (למשל תאריך לידה סמוך לשקיעה), ניתן
        להזיז אותו יום אחד קדימה או אחורה - אין אפשרות להזין תאריך עברי חופשי.
      </p>
    </div>
  );
}

import {
  addDays,
  formatHebrewDateField,
  formatIsraeliShortDate,
  getHebrewCalendarParts,
  type CalendarDate,
  type HebrewCalendarParts,
} from '@nera/calendar-engine';

export type HebrewDateAdjustment = -1 | 0 | 1;

/**
 * Computes the displayed Hebrew birth date from a Gregorian date plus an
 * explicit -1/0/+1 day adjustment. The adjustment exists because a birth
 * date recorded without a time of day is ambiguous right at sunset (the
 * Hebrew calendar day boundary) - shifting the underlying Gregorian date
 * by a whole day before conversion, then reconverting through the
 * Calendar Engine, is the only Hebrew-date "editing" allowed: there is no
 * free-text override of the computed Hebrew string anywhere in the app.
 *
 * Uses formatHebrewDateField (day + bare month name + year, no "ב" prefix)
 * - the birth date is a standalone date FIELD, not part of a sentence (the
 * dashboard's "today is ..." full-sentence display is a different,
 * deliberately untouched code path - see that function's docstring). All
 * Hebrew gematria conversion happens inside @nera/calendar-engine -
 * nothing here reimplements or hardcodes it.
 */
export function computeHebrewBirthDate(birthDateGregorian: string, adjustmentDays: HebrewDateAdjustment): CalendarDate {
  const adjustedDate = adjustmentDays === 0 ? birthDateGregorian : addDays(birthDateGregorian, adjustmentDays);
  return { system: 'hebrew', isoDate: birthDateGregorian, display: formatHebrewDateField(adjustedDate) };
}

/**
 * Displays the stored Gregorian birth date in Israeli short format
 * (DD/MM/YYYY) - via formatIsraeliShortDate's pure string manipulation of
 * the already-unambiguous YYYY-MM-DD value, never via Date-object
 * re-parsing, so day and month can never be transposed (see the Calendar
 * Engine's formatIsraeliShortDate docstring for the full rationale).
 */
export function formatGregorianBirthDate(birthDateGregorian: string): CalendarDate {
  return { system: 'gregorian', isoDate: birthDateGregorian, display: formatIsraeliShortDate(birthDateGregorian) };
}

/** Structured Hebrew calendar parts (day/month/year) for the same adjusted date computeHebrewBirthDate displays - used for filtering, never for display formatting (see computeHebrewBirthDate for that). */
export function getHebrewBirthDateParts(birthDateGregorian: string, adjustmentDays: HebrewDateAdjustment): HebrewCalendarParts {
  const adjustedDate = adjustmentDays === 0 ? birthDateGregorian : addDays(birthDateGregorian, adjustmentDays);
  return getHebrewCalendarParts(adjustedDate);
}

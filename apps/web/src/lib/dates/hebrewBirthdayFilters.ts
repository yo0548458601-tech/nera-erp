import { findNextHebrewAnniversary, toCalendarDateUTC, type HebrewCalendarParts } from '@nera/calendar-engine';
import { getHebrewBirthDateParts, type HebrewDateAdjustment } from './hebrewBirthDate';

/**
 * matchesHebrewMonth/matchesHebrewDay are generic Hebrew-date predicates
 * (see @nera/calendar-engine's own docstring on them) - re-exported here
 * only so this module's existing call sites (PeopleFiltersBar.tsx) don't
 * need to change their import path. Any future, non-Contacts module should
 * import them directly from @nera/calendar-engine instead of from here.
 */
export { matchesHebrewMonth, matchesHebrewDay } from '@nera/calendar-engine';

/**
 * Whether a person's (adjustment-corrected) Hebrew birthday falls within
 * the next `withinDays` days of `todayIso`. This is an EXACT calculation:
 * findNextHebrewAnniversary (Calendar Engine) scans real Gregorian dates
 * and asks the same Intl-backed Hebrew conversion used everywhere else in
 * the app which one is the next real occurrence of the target Hebrew
 * (month, day) - there is no month*30-style approximation here anymore
 * (that was P007.3's placeholder, replaced per P007.4). Both `next` and
 * the `todayIso` comparison point go through the same UTC-noon-anchored
 * date construction, so the day-difference is an exact integer.
 */
export function isUpcomingHebrewBirthday(birthDateGregorian: string, adjustmentDays: HebrewDateAdjustment, todayIso: string, withinDays: number): boolean {
  const targetParts = getHebrewBirthDateParts(birthDateGregorian, adjustmentDays);
  const next = findNextHebrewAnniversary(todayIso, targetParts.month, targetParts.day);
  if (!next) {
    return false;
  }

  const todayDate = toCalendarDateUTC(todayIso);
  const diffDays = Math.round((next.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= withinDays;
}

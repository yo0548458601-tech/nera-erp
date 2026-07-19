export type CalendarSystem = 'gregorian' | 'hebrew';

export type DateDisplayMode = 'short' | 'long' | 'date';

export type CalendarDate = {
  system: CalendarSystem;
  isoDate: string;
  display: string;
};

export type CalendarContext = {
  locale: string;
  timeZone: string;
  defaultSystem: CalendarSystem;
};

export const defaultCalendarContext: CalendarContext = {
  locale: 'he-IL',
  timeZone: 'Asia/Jerusalem',
  defaultSystem: 'gregorian',
};

const CALENDAR_TAG: Record<CalendarSystem, string> = {
  gregorian: 'gregory',
  hebrew: 'hebrew',
};

const GERESH = '׳';
const GERSHAYIM = '״';

const HUNDREDS: Array<[number, string]> = [
  [400, 'ת'],
  [300, 'ש'],
  [200, 'ר'],
  [100, 'ק'],
];

const TENS: Array<[number, string]> = [
  [90, 'צ'],
  [80, 'פ'],
  [70, 'ע'],
  [60, 'ס'],
  [50, 'נ'],
  [40, 'מ'],
  [30, 'ל'],
  [20, 'כ'],
  [10, 'י'],
];

const UNITS: Array<[number, string]> = [
  [9, 'ט'],
  [8, 'ח'],
  [7, 'ז'],
  [6, 'ו'],
  [5, 'ה'],
  [4, 'ד'],
  [3, 'ג'],
  [2, 'ב'],
  [1, 'א'],
];

/**
 * Converts an integer into traditional Hebrew numeral letters (gematria),
 * e.g. 28 -> "כ״ח", 786 -> "תשפ״ו". 15/16 are special-cased to ט״ו/ט״ז to
 * avoid spelling divine-name fragments (יה/יו), per standard convention.
 * The Intl API cannot do this (V8 does not support algorithmic numbering
 * systems like Hebrew for Intl.NumberFormat), so it's implemented directly.
 */
export function toHebrewNumeral(value: number): string {
  let remainder = value;
  const letters: string[] = [];

  for (const [amount, letter] of HUNDREDS) {
    while (remainder >= amount) {
      letters.push(letter);
      remainder -= amount;
    }
  }

  if (remainder === 15) {
    letters.push('ט', 'ו');
    remainder = 0;
  } else if (remainder === 16) {
    letters.push('ט', 'ז');
    remainder = 0;
  } else {
    for (const [amount, letter] of TENS) {
      if (remainder >= amount) {
        letters.push(letter);
        remainder -= amount;
        break;
      }
    }
    for (const [amount, letter] of UNITS) {
      if (remainder >= amount) {
        letters.push(letter);
        remainder -= amount;
        break;
      }
    }
  }

  if (letters.length === 0) {
    return '';
  }
  if (letters.length === 1) {
    return `${letters[0]}${GERESH}`;
  }
  return `${letters.slice(0, -1).join('')}${GERSHAYIM}${letters[letters.length - 1]}`;
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a strict `YYYY-MM-DD` calendar-date string into its numeric parts.
 * Never uses the native `Date` constructor for this, and never accepts
 * `DD/MM/YYYY` or any other ambiguous format - callers must convert to
 * `YYYY-MM-DD` (the platform's one unambiguous internal representation)
 * before calling anything in this module. Throws on malformed input rather
 * than silently guessing, since a silently-swapped day/month is exactly
 * the class of bug this function exists to prevent.
 */
export function parseIsoCalendarDate(value: string): { year: number; month: number; day: number } {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Expected an ISO calendar date "YYYY-MM-DD", received "${value}"`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/**
 * Builds a `Date` for a calendar-date-only value (no time component)
 * anchored at UTC noon rather than UTC midnight. This is the fix for a
 * class of off-by-one-day bug: a date-only value interpreted at UTC
 * midnight can roll over to the adjacent calendar day once formatted in a
 * timezone behind UTC (or shift the other way, ahead of UTC, depending on
 * context) - anchoring at noon UTC leaves a +/-12 hour margin, which is
 * larger than any real-world UTC offset (-12 to +14), so the calendar day
 * can never shift regardless of which timeZone a CalendarContext uses.
 */
export function toCalendarDateUTC(value: string): Date {
  const { year, month, day } = parseIsoCalendarDate(value);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/**
 * Normalizes any input this module accepts into a `Date`: a strict
 * `YYYY-MM-DD` string goes through the timezone-safe toCalendarDateUTC path
 * above (never the native Date constructor's ambiguous string parsing); any
 * other string or a Date object passes through as before (used for the
 * rare caller that already has a full timestamp, not just a calendar date).
 */
function toDate(value: string | Date): Date {
  if (typeof value !== 'string') {
    return value;
  }
  return CALENDAR_DATE_PATTERN.test(value) ? toCalendarDateUTC(value) : new Date(value);
}

/**
 * Formats a strict `YYYY-MM-DD` calendar-date string as the Israeli short
 * format `DD/MM/YYYY`, via pure string manipulation of the already-parsed
 * numeric parts - no `Date` object, no `Intl`, no timezone is involved in
 * this step at all, so day and month can never be transposed.
 */
export function formatIsraeliShortDate(value: string): string {
  const { year, month, day } = parseIsoCalendarDate(value);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** Today's calendar date (YYYY-MM-DD) in the given context's timezone - the one safe way to ask "what is today" without the caller's own local clock/timezone leaking in. */
export function getTodayIsoDate(context: CalendarContext = defaultCalendarContext): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: context.timeZone }).format(new Date());
}

function buildFormatter(system: CalendarSystem, mode: DateDisplayMode, context: CalendarContext) {
  const localeWithCalendar = `${context.locale}-u-ca-${CALENDAR_TAG[system]}`;

  return new Intl.DateTimeFormat(localeWithCalendar, {
    timeZone: context.timeZone,
    day: 'numeric',
    month: mode === 'short' ? 'numeric' : 'long',
    year: 'numeric',
    weekday: mode === 'long' ? 'long' : undefined,
  });
}

/** Shifts a date by a whole number of days, independent of time zone/DST edge cases. */
export function addDays(value: string | Date, days: number): Date {
  const date = toDate(value);
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function formatHebrewDisplay(formatter: Intl.DateTimeFormat, date: Date): string {
  return formatter
    .formatToParts(date)
    .map(part => {
      if (part.type === 'day') {
        return toHebrewNumeral(Number(part.value));
      }
      if (part.type === 'year') {
        return toHebrewNumeral(Number(part.value) % 1000);
      }
      return part.value;
    })
    .join('');
}

export function formatDate(
  value: string | Date,
  system: CalendarSystem,
  mode: DateDisplayMode = 'short',
  context: CalendarContext = defaultCalendarContext
): CalendarDate {
  const date = toDate(value);
  const isoDate = date.toISOString().slice(0, 10);
  const formatter = buildFormatter(system, mode, context);
  const display =
    system === 'hebrew' ? formatHebrewDisplay(formatter, date) : formatter.format(date);

  return {
    system,
    isoDate,
    display,
  };
}

export function createCalendarContext(overrides: Partial<CalendarContext> = {}): CalendarContext {
  return {
    ...defaultCalendarContext,
    ...overrides,
  };
}

export type HebrewCalendarParts = {
  day: number;
  /** 1-based Hebrew month index within this date's Hebrew year (13 only exists in a leap year). See getHebrewCalendarParts for how this is derived. */
  month: number;
  /** Hebrew month name (e.g. "תמוז", "אדר א׳"), computed via Intl - never hardcoded. */
  monthName: string;
  year: number;
};

/**
 * ICU's Hebrew calendar formatter silently ignores `month: 'numeric'` and
 * always substitutes the month NAME regardless of locale (a documented ICU
 * limitation for calendars whose months are traditionally named, not
 * numbered - Hebrew and Chinese both do this). Only day/year come back as
 * real numbers; month never does. This reads just the day/year numbers and
 * the month name, with no attempt at a numeric month - that gap is closed
 * separately, see resolveHebrewMonthIndex.
 */
function getRawHebrewParts(
  date: Date,
  context: CalendarContext
): { day: number; monthName: string; year: number } {
  const localeWithCalendar = `${context.locale}-u-ca-${CALENDAR_TAG.hebrew}`;
  const dayYearParts = new Intl.DateTimeFormat(localeWithCalendar, {
    timeZone: context.timeZone,
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(date);
  const namedParts = new Intl.DateTimeFormat(localeWithCalendar, {
    timeZone: context.timeZone,
    month: 'long',
  }).formatToParts(date);

  return {
    day: Number(dayYearParts.find(part => part.type === 'day')?.value ?? 0),
    year: Number(dayYearParts.find(part => part.type === 'year')?.value ?? 0),
    monthName: namedParts.find(part => part.type === 'month')?.value ?? '',
  };
}

/** Memoized per Hebrew year: month name -> 1-based month index (Tishrei = 1). Populated lazily by resolveHebrewMonthIndex; safe to keep for the process lifetime since a given Hebrew year's month sequence never changes. */
const hebrewMonthIndexByYear = new Map<number, Map<string, number>>();

/**
 * Derives the 1-based Hebrew month index for `date`, since Intl cannot
 * provide one directly (see getRawHebrewParts). Walks backward day by day
 * from `date` until the Hebrew year number decrements - i.e. until it
 * crosses Rosh Hashanah into the previous Hebrew year - counting each
 * distinct month-name transition along the way. Because Tishrei (month 1)
 * is by definition the month immediately following that crossing, the
 * count of distinct months seen during the walk is exactly the target
 * date's month index. This uses only Intl-derived day/year numbers and
 * month-name string comparisons - it is not a reimplementation of
 * Hebrew/Gregorian date conversion, only a way to number the months Intl
 * already named correctly. Results are cached per Hebrew year so this
 * backward walk runs at most once per distinct year encountered.
 */
function resolveHebrewMonthIndex(
  date: Date,
  monthName: string,
  year: number,
  context: CalendarContext
): number {
  const cachedYear = hebrewMonthIndexByYear.get(year);
  const cachedIndex = cachedYear?.get(monthName);
  if (cachedIndex !== undefined) {
    return cachedIndex;
  }

  const namesNewestFirst: string[] = [monthName];
  let probe = date;

  for (let i = 0; i < 400; i += 1) {
    probe = addDays(probe, -1);
    const previous = getRawHebrewParts(probe, context);
    if (previous.year < year) {
      break;
    }
    if (previous.monthName !== namesNewestFirst[namesNewestFirst.length - 1]) {
      namesNewestFirst.push(previous.monthName);
    }
  }

  const namesInOrder = [...namesNewestFirst].reverse();
  const yearMap = new Map<string, number>();
  namesInOrder.forEach((name, index) => yearMap.set(name, index + 1));
  hebrewMonthIndexByYear.set(year, yearMap);

  return yearMap.get(monthName) ?? 0;
}

/** Structured Hebrew calendar parts (day/month/year as numbers, plus the month name) for filtering/grouping - formatDate('hebrew', ...) covers display strings, this covers structured access to the same underlying Intl conversion, with the month-index gap (see getRawHebrewParts) resolved via resolveHebrewMonthIndex. */
export function getHebrewCalendarParts(
  value: string | Date,
  context: CalendarContext = defaultCalendarContext
): HebrewCalendarParts {
  const date = toDate(value);
  const raw = getRawHebrewParts(date, context);
  const month = resolveHebrewMonthIndex(date, raw.monthName, raw.year, context);

  return { day: raw.day, month, monthName: raw.monthName, year: raw.year };
}

/**
 * Lists the Hebrew month names, in true calendar order starting at Tishrei,
 * for the Hebrew year that contains `referenceDate` (defaults to today) - a
 * 13th month only appears when that specific year is a leap year, exactly
 * as the real calendar works. Reuses the same month-index resolution as
 * getHebrewCalendarParts (and its cache), so this never duplicates the
 * Hebrew-year-boundary walk.
 */
export function listHebrewMonthNames(
  referenceDate: string | Date = new Date(),
  context: CalendarContext = defaultCalendarContext
): string[] {
  const parts = getHebrewCalendarParts(referenceDate, context);
  const yearMap = hebrewMonthIndexByYear.get(parts.year);
  if (!yearMap) {
    return [parts.monthName];
  }
  return Array.from(yearMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
}

/**
 * Finds the next real Gregorian date on/after `fromDate` whose Hebrew
 * calendar (month, day) equals (targetMonth, targetDay) - e.g. the next
 * occurrence of a Hebrew birthday. This is deliberately NOT a from-scratch
 * Hebrew calendar algorithm: it scans forward one real day at a time and
 * asks the same Intl-backed getHebrewCalendarParts (the platform's single
 * source of truth for Gregorian<->Hebrew conversion) what each day's
 * Hebrew date is, stopping at the first exact match. There is no
 * approximation (no month*30-style arithmetic) - every candidate day's
 * Hebrew date is the real, ICU-computed value.
 *
 * Leap year / Adar policy (documented, not silently guessed): Adar II
 * (Hebrew month 13) exists only in a leap year. If targetMonth is 13 and
 * the next twelve-month year is not a leap year, no month-13 day exists in
 * that year's scan window, so the search simply continues into the next
 * year that has one - it does NOT fall back to plain Adar (month 12) on
 * the caller's behalf. A caller that wants "plain Adar in a non-leap year"
 * as an equivalent anniversary must decide that policy explicitly (e.g. by
 * calling again with targetMonth 12) rather than have it applied silently
 * here, per the platform rule that an unresolved calendar ambiguity must
 * be surfaced, not quietly approximated.
 */
export function findNextHebrewAnniversary(
  fromDate: string | Date,
  targetMonth: number,
  targetDay: number,
  context: CalendarContext = defaultCalendarContext,
  searchWindowDays = 400
): Date | undefined {
  let probe = toDate(fromDate);

  for (let i = 0; i < searchWindowDays; i += 1) {
    const parts = getHebrewCalendarParts(probe, context);
    if (parts.month === targetMonth && parts.day === targetDay) {
      return probe;
    }
    probe = addDays(probe, 1);
  }

  return undefined;
}

/**
 * Displays a Hebrew calendar date as a standalone date FIELD - Hebrew day
 * + Hebrew month name + Hebrew year, e.g. "ח׳ אדר תשפ״ה" - deliberately
 * without the grammatical prefix "ב" that Intl's sentence-style Hebrew
 * formatting inserts before the month (formatDate(...,'hebrew','long')
 * still produces that full-sentence form, e.g. for the dashboard's "today
 * is ..." display, where the prefix is grammatically correct - this
 * function is for contexts where the date is a labeled field, not part of
 * a sentence: forms, detail pages, list columns, filters, exports).
 * Reuses the same toHebrewNumeral gematria conversion and the same
 * Intl-derived day/monthName/year as every other Hebrew-date function in
 * this engine - no second numeral algorithm, no hardcoded month names.
 */
export function formatHebrewDateField(
  value: string | Date,
  context: CalendarContext = defaultCalendarContext
): string {
  const parts = getHebrewCalendarParts(value, context);
  return `${toHebrewNumeral(parts.day)} ${parts.monthName} ${toHebrewNumeral(parts.year % 1000)}`;
}

/**
 * Returns the number of days (29 or 30) in Hebrew month `month`, for the
 * specific Hebrew year that `referenceDate` (defaults to today) falls in -
 * `referenceDate` must itself fall within an occurrence of `month` (e.g.
 * today, if `month` is today's Hebrew month; or any date already known to
 * be inside the target month/year). Hebrew months are always 29 or 30
 * days; two of them (Cheshvan and Kislev) vary between years depending on
 * that year's type, so this is evaluated against a specific year rather
 * than being a fixed table.
 *
 * Deliberately does NOT use findNextHebrewAnniversary's forward cross-year
 * search here: a bare month INDEX means a different month depending on
 * whether the year is a leap year (e.g. Nisan is index 7 in a regular year
 * but index 8 in a leap year, since Adar splits into two months) - jumping
 * forward into a different, differently-typed year while reusing the same
 * index would silently ask about the wrong month. Instead this walks
 * backward from `referenceDate` (bounded to <=31 days) to find day 1 of
 * ITS OWN current month/year occurrence, then walks forward from there
 * (bounded to the same year and month) checking whether day 30 exists -
 * both walks use only the same Intl-backed getHebrewCalendarParts oracle
 * used everywhere else in this engine.
 */
export function getHebrewMonthLength(
  month: number,
  referenceDate: string | Date = new Date(),
  context: CalendarContext = defaultCalendarContext
): number {
  const refParts = getHebrewCalendarParts(referenceDate, context);

  let day1Probe = toDate(referenceDate);
  for (let i = 0; i < 31; i += 1) {
    const parts = getHebrewCalendarParts(day1Probe, context);
    if (parts.day === 1) {
      break;
    }
    day1Probe = addDays(day1Probe, -1);
  }

  let hasDay30 = false;
  let forwardProbe = day1Probe;
  for (let i = 0; i < 31; i += 1) {
    const parts = getHebrewCalendarParts(forwardProbe, context);
    if (parts.year !== refParts.year || parts.month !== month) {
      break;
    }
    if (parts.day === 30) {
      hasDay30 = true;
      break;
    }
    forwardProbe = addDays(forwardProbe, 1);
  }

  return hasDay30 ? 30 : 29;
}

/**
 * Generic Hebrew-calendar filter predicates, usable by any module that
 * needs "does this date fall on Hebrew month/day X" (e.g. Contacts' Hebrew
 * birthday filter today; a future Donations module filtering by Hebrew
 * yahrzeit date, or any other Hebrew-date field). Deliberately placed in
 * the engine rather than in a module-specific file: they operate purely on
 * HebrewCalendarParts (already module-agnostic) with zero knowledge of
 * what the date represents (birth date, anniversary, etc.) - a future
 * module should call these directly rather than reaching into a
 * Contacts-named file. See apps/web's hebrewBirthdayFilters.ts, which
 * re-exports these for its existing call sites and adds only the
 * genuinely birth-date-specific "next occurrence within N days" logic on
 * top.
 */
export function matchesHebrewMonth(parts: HebrewCalendarParts, month: number): boolean {
  return parts.month === month;
}

export function matchesHebrewDay(parts: HebrewCalendarParts, day: number): boolean {
  return parts.day === day;
}

/**
 * Chronological comparator for two CalendarDate values (or raw ISO date
 * strings), for use by any module's sort/list logic regardless of which
 * calendar `system` either date displays in. Comparing by `isoDate` (the
 * real Gregorian anchor every CalendarDate carries - see CalendarDate's
 * docstring) is the only safe generic sort key: a bare Hebrew month INDEX
 * cannot be compared directly across years, since the same index can name
 * a different month depending on whether that Hebrew year is a leap year
 * (see getHebrewMonthLength's docstring for the concrete example). Two
 * dates in different calendar systems (one Gregorian-displayed, one
 * Hebrew-displayed) sort correctly against each other too, since both
 * reduce to the same ISO anchor.
 */
export function compareCalendarDates(a: string | CalendarDate, b: string | CalendarDate): number {
  const isoA = typeof a === 'string' ? a : a.isoDate;
  const isoB = typeof b === 'string' ? b : b.isoDate;
  return isoA < isoB ? -1 : isoA > isoB ? 1 : 0;
}

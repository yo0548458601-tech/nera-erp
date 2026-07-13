export type CalendarSystem = 'gregorian' | 'hebrew';

export type DateDisplayMode = 'short' | 'long';

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
function toHebrewNumeral(value: number): string {
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

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

function buildFormatter(system: CalendarSystem, mode: DateDisplayMode, context: CalendarContext) {
  const localeWithCalendar = `${context.locale}-u-ca-${CALENDAR_TAG[system]}`;

  return new Intl.DateTimeFormat(localeWithCalendar, {
    timeZone: context.timeZone,
    day: 'numeric',
    month: mode === 'long' ? 'long' : 'numeric',
    year: 'numeric',
    weekday: mode === 'long' ? 'long' : undefined,
  });
}

function formatHebrewDisplay(formatter: Intl.DateTimeFormat, date: Date): string {
  return formatter
    .formatToParts(date)
    .map((part) => {
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
  const display = system === 'hebrew' ? formatHebrewDisplay(formatter, date) : formatter.format(date);

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

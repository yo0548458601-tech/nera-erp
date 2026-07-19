import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareCalendarDates,
  findNextHebrewAnniversary,
  formatDate,
  formatHebrewDateField,
  formatIsraeliShortDate,
  getHebrewCalendarParts,
  getHebrewMonthLength,
  getTodayIsoDate,
  matchesHebrewDay,
  matchesHebrewMonth,
  parseIsoCalendarDate,
  toCalendarDateUTC,
  toHebrewNumeral,
} from './index';

describe('parseIsoCalendarDate / formatIsraeliShortDate - no day/month ambiguity', () => {
  const ambiguousCases: Array<{
    iso: string;
    expectedShort: string;
    expectedDay: number;
    expectedMonth: number;
    expectedYear: number;
  }> = [
    {
      iso: '1999-06-05',
      expectedShort: '05/06/1999',
      expectedDay: 5,
      expectedMonth: 6,
      expectedYear: 1999,
    },
    {
      iso: '1999-05-06',
      expectedShort: '06/05/1999',
      expectedDay: 6,
      expectedMonth: 5,
      expectedYear: 1999,
    },
    {
      iso: '1975-06-14',
      expectedShort: '14/06/1975',
      expectedDay: 14,
      expectedMonth: 6,
      expectedYear: 1975,
    },
    {
      iso: '2013-09-01',
      expectedShort: '01/09/2013',
      expectedDay: 1,
      expectedMonth: 9,
      expectedYear: 2013,
    },
  ];

  it.each(ambiguousCases)(
    'parses and formats $iso without swapping day/month',
    ({ iso, expectedShort, expectedDay, expectedMonth, expectedYear }) => {
      const parts = parseIsoCalendarDate(iso);
      expect(parts).toEqual({ year: expectedYear, month: expectedMonth, day: expectedDay });
      expect(formatIsraeliShortDate(iso)).toBe(expectedShort);
    }
  );

  it('rejects non-ISO / ambiguous DD/MM/YYYY input rather than guessing', () => {
    expect(() => parseIsoCalendarDate('14/06/1975')).toThrow();
    expect(() => parseIsoCalendarDate('06/14/1975')).toThrow();
  });
});

describe('toCalendarDateUTC - timezone-safe, never rolls to the adjacent day', () => {
  it('keeps the same UTC calendar day for a range of IANA timezones', () => {
    const zones = [
      'Pacific/Kiritimati',
      'Asia/Jerusalem',
      'UTC',
      'America/Los_Angeles',
      'Pacific/Niue',
    ];
    for (const timeZone of zones) {
      const date = toCalendarDateUTC('1975-06-14');
      const formatted = new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
      expect(formatted).toBe('1975-06-14');
    }
  });
});

describe('formatDate(gregorian) uses the correctly interpreted date', () => {
  it('formats 1975-06-14 as June, not a swapped month', () => {
    const result = formatDate('1975-06-14', 'gregorian', 'date');
    expect(result.display).toContain('14');
    expect(result.display.toLowerCase()).toContain('יוני');
  });
});

describe('addDays', () => {
  it('shifts forward across a month boundary without drifting a timezone day', () => {
    const shifted = addDays('2013-08-31', 1);
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(shifted);
    expect(iso).toBe('2013-09-01');
  });

  it('shifts backward across a year boundary', () => {
    const shifted = addDays('2000-01-01', -1);
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(shifted);
    expect(iso).toBe('1999-12-31');
  });
});

describe('getTodayIsoDate', () => {
  it('returns a strict YYYY-MM-DD string', () => {
    expect(getTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('findNextHebrewAnniversary - exact search, not an approximation', () => {
  it('finds the same day when today already matches the target Hebrew date', () => {
    const today = '2026-07-16';
    const todayHebrew = getHebrewCalendarParts(today);
    const next = findNextHebrewAnniversary(today, todayHebrew.month, todayHebrew.day);
    expect(next).toBeDefined();
    const nextIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(next!);
    expect(nextIso).toBe(today);
  });

  it('finds a future occurrence within the same Hebrew year', () => {
    const from = '2026-01-01';
    const fromHebrew = getHebrewCalendarParts(from);
    const next = findNextHebrewAnniversary(
      from,
      fromHebrew.month,
      fromHebrew.day + 1 <= 29 ? fromHebrew.day + 1 : fromHebrew.day
    );
    expect(next).toBeDefined();
  });

  it('wraps across a Hebrew year boundary and matches the exact real Hebrew date, not an arithmetic approximation', () => {
    // Elul (month 12 in a non-leap year, near Hebrew year end) wrapping into next Tishrei.
    const from = '2026-08-01';
    const target = getHebrewCalendarParts('2027-08-20');
    const next = findNextHebrewAnniversary(from, target.month, target.day);
    expect(next).toBeDefined();
    const foundParts = getHebrewCalendarParts(next!);
    expect(foundParts.month).toBe(target.month);
    expect(foundParts.day).toBe(target.day);
  });

  it('handles an Adar II (leap-month) target by finding a real leap year rather than guessing', () => {
    // Find a real Adar II date first (search forward until month 13 is observed), then confirm
    // findNextHebrewAnniversary can re-find that same exact (month, day) starting from before it.
    let probe = '2024-01-01';
    let leapDate: string | undefined;
    let leapParts: { month: number; day: number } | undefined;
    for (let i = 0; i < 1500 && !leapDate; i += 1) {
      const parts = getHebrewCalendarParts(probe);
      if (parts.month === 13) {
        leapDate = probe;
        leapParts = { month: parts.month, day: parts.day };
      }
      probe = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(
        addDays(probe, 1)
      );
    }

    expect(leapParts).toBeDefined();
    const next = findNextHebrewAnniversary('2024-01-01', leapParts!.month, leapParts!.day);
    expect(next).toBeDefined();
    const foundParts = getHebrewCalendarParts(next!);
    expect(foundParts.month).toBe(13);
    expect(foundParts.day).toBe(leapParts!.day);
  });
});

describe('formatHebrewDateField - standalone date field, no "ב" month prefix', () => {
  it('formats as "day month year" with no prefix before the month name', () => {
    // 1975-06-14 is Hebrew ה׳ בתמוז תשל״ה in sentence form; the field form must read "ה׳ תמוז תשל״ה".
    const display = formatHebrewDateField('1975-06-14');
    expect(display).not.toContain('ב' + 'תמוז');
    expect(display.split(' ')).toHaveLength(3);
    expect(display).toMatch(/^[א-ת"׳״]+ תמוז [א-ת"׳״]+$/);
  });

  it('never includes the definite/prefix letter directly fused to the month name for a range of dates', () => {
    const sampleDates = ['2026-01-15', '2026-03-01', '2026-07-16', '2026-11-30'];
    for (const iso of sampleDates) {
      const display = formatHebrewDateField(iso);
      const parts = display.split(' ');
      expect(parts).toHaveLength(3);
      // The middle token must be the bare month name (matches getHebrewCalendarParts.monthName exactly).
      const hebrewParts = getHebrewCalendarParts(iso);
      expect(parts[1]).toBe(hebrewParts.monthName);
    }
  });
});

describe('toHebrewNumeral (exported) matches expected gematria for day-filter labels', () => {
  const cases: Array<[number, string]> = [
    [1, 'א׳'],
    [2, 'ב׳'],
    [15, 'ט״ו'],
    [16, 'ט״ז'],
    [29, 'כ״ט'],
    [30, 'ל׳'],
  ];

  it.each(cases)('formats %i as %s', (value, expected) => {
    expect(toHebrewNumeral(value)).toBe(expected);
  });
});

describe('getHebrewMonthLength - real 29/30-day determination, not a fixed table', () => {
  it('reports 29 days for Tevet (a fixed 29-day month every year)', () => {
    // Find Tevet's month index for a known date, then check its length.
    const parts = getHebrewCalendarParts('2026-01-01');
    // Walk to find the month index whose Hebrew name is "טבת" via listHebrewMonthNames-equivalent search.
    // Tevet always immediately follows Kislev; use getHebrewCalendarParts directly on a known Tevet date instead.
    const tevetDate = '2026-01-10'; // within Hebrew month Tevet 5786
    const tevetParts = getHebrewCalendarParts(tevetDate);
    expect(tevetParts.monthName).toBe('טבת');
    expect(getHebrewMonthLength(tevetParts.month, tevetDate)).toBe(29);
    expect(parts).toBeDefined();
  });

  it('reports 30 days for Nisan (a fixed 30-day month every year)', () => {
    const nisanDate = '2026-04-01'; // within Hebrew month Nisan 5786
    const nisanParts = getHebrewCalendarParts(nisanDate);
    expect(nisanParts.monthName).toBe('ניסן');
    expect(getHebrewMonthLength(nisanParts.month, nisanDate)).toBe(30);
  });

  it('reports 29 days for Iyar (a fixed 29-day month every year)', () => {
    const iyarDate = '2026-05-01';
    const iyarParts = getHebrewCalendarParts(iyarDate);
    expect(iyarParts.monthName).toBe('אייר');
    expect(getHebrewMonthLength(iyarParts.month, iyarDate)).toBe(29);
  });

  it('reports 30 days for Tishrei (a fixed 30-day month every year)', () => {
    const tishreiDate = '2025-10-10';
    const tishreiParts = getHebrewCalendarParts(tishreiDate);
    expect(tishreiParts.monthName).toBe('תשרי');
    expect(getHebrewMonthLength(tishreiParts.month, tishreiDate)).toBe(30);
  });
});

describe('matchesHebrewMonth / matchesHebrewDay - generic, module-agnostic predicates', () => {
  it('match only the exact Hebrew month/day, independent of what the date represents', () => {
    const parts = getHebrewCalendarParts('2026-01-10'); // Tevet 5786
    expect(matchesHebrewMonth(parts, parts.month)).toBe(true);
    expect(matchesHebrewMonth(parts, parts.month + 1)).toBe(false);
    expect(matchesHebrewDay(parts, parts.day)).toBe(true);
    expect(matchesHebrewDay(parts, parts.day === 1 ? 2 : 1)).toBe(false);
  });
});

describe('compareCalendarDates - safe chronological sort across calendar systems', () => {
  it('orders raw ISO strings chronologically', () => {
    expect(compareCalendarDates('2025-01-01', '2026-01-01')).toBeLessThan(0);
    expect(compareCalendarDates('2026-01-01', '2025-01-01')).toBeGreaterThan(0);
    expect(compareCalendarDates('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('orders CalendarDate values by their isoDate anchor regardless of displayed system', () => {
    const earlier = { system: 'hebrew' as const, isoDate: '2026-01-01', display: 'י״א טבת תשפ״ו' };
    const later = { system: 'gregorian' as const, isoDate: '2026-04-01', display: '01/04/2026' };
    expect(compareCalendarDates(earlier, later)).toBeLessThan(0);
    expect([later, earlier].sort(compareCalendarDates)).toEqual([earlier, later]);
  });
});

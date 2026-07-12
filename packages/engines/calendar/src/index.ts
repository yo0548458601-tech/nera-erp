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

export function formatDate(
  value: string | Date,
  system: CalendarSystem,
  mode: DateDisplayMode = 'short',
  context: CalendarContext = defaultCalendarContext
): CalendarDate {
  const date = typeof value === 'string' ? new Date(value) : value;
  const isoDate = date.toISOString().slice(0, 10);
  const baseDisplay = system === 'hebrew' ? `${isoDate} (עברית)` : `${isoDate} (Gregorian)`;

  return {
    system,
    isoDate,
    display: mode === 'long' ? `${baseDisplay} · ${context.locale}` : baseDisplay,
  };
}

export function createCalendarContext(overrides: Partial<CalendarContext> = {}): CalendarContext {
  return {
    ...defaultCalendarContext,
    ...overrides,
  };
}

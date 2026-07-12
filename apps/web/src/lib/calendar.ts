import { createCalendarContext, formatDate, type CalendarSystem } from '@nera/calendar-engine';

export function getCalendarSummary(value: string | Date, system: CalendarSystem) {
  const context = createCalendarContext({ defaultSystem: system, locale: 'he-IL' });
  return formatDate(value, system, 'long', context);
}

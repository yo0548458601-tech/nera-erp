'use client';

import { useMemo, useState } from 'react';
import { defaultSettings, resolveSetting, type RuntimeSetting } from '@nera/settings-engine';
import { getCalendarSummary } from '../lib/calendar';

const initialSettings = defaultSettings.reduce<Record<string, RuntimeSetting>>((accumulator, definition) => {
  accumulator[definition.key] = {
    ...definition,
    value: definition.defaultValue,
  };
  return accumulator;
}, {});

export function PlatformShell() {
  const [settings, setSettings] = useState<Record<string, RuntimeSetting>>(initialSettings);
  const [calendarSystem, setCalendarSystem] = useState<'gregorian' | 'hebrew'>('gregorian');

  const currentCalendar = useMemo(() => getCalendarSummary('2026-07-12', calendarSystem), [calendarSystem]);
  const currentSetting = resolveSetting(settings, 'calendar.system');

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Nera Platform</p>
          <h1 className="mt-3 text-3xl font-bold">מערכת הפלטפורמה</h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-300">
            זהו בסיס פלטפורמה ברמה גבוהה, תואם לארכיטקטורה המאושרת, עם תמיכה בלוח שנה גרגוריאני ועברי.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">הגדרות פלטפורמה</h2>
            <p className="mt-2 text-sm text-slate-400">כל ההגדרות נשמרות כקונפיגורציה נפרדת מהקוד.</p>
            <div className="mt-6 space-y-4">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">בחירת לוח שנה</span>
                <select
                  value={calendarSystem}
                  onChange={event => setCalendarSystem(event.target.value as 'gregorian' | 'hebrew')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  <option value="gregorian">לוח שנה לועזי</option>
                  <option value="hebrew">לוח שנה עברי</option>
                </select>
              </label>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">הגדרה נוכחית</p>
                <p className="mt-2 text-lg font-medium">{currentSetting?.value}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">תצוגת תאריך</h2>
            <p className="mt-2 text-sm text-slate-400">התצוגה נבנית דרך מנוע לוח שנה נפרד.</p>
            <div className="mt-6 rounded-xl border border-cyan-700/40 bg-cyan-950/40 p-4">
              <p className="text-sm text-cyan-200">תצוגה נוכחית</p>
              <p className="mt-2 text-xl font-semibold">{currentCalendar.display}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

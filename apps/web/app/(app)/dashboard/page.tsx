'use client';

import { useState } from 'react';
import { DashboardContent } from '@/src/components/DashboardContent';
import { PageHeader } from '@/src/components/shell/PageHeader';

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<'gregorian' | 'hebrew' | 'both'>('both');
  const [dashboardState, setDashboardState] = useState<'loading' | 'ready' | 'empty' | 'error'>('ready');

  return (
    <>
      <PageHeader subtitle="תמונת מצב כללית על הארגון: הכנסות, משימות ואירועים קרובים.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">מצב הדגמה</p>
            <p className="text-sm text-slate-500">המערכת נפתחת בסביבה מקומית בלבד ללא כתיבה למסד.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDashboardState('loading')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              טעינה
            </button>
            <button type="button" onClick={() => setDashboardState('empty')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              ריק
            </button>
            <button type="button" onClick={() => setDashboardState('error')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              שגיאה
            </button>
            <button type="button" onClick={() => setDashboardState('ready')} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm text-cyan-700">
              מוכן
            </button>
            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm"
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value as 'gregorian' | 'hebrew' | 'both')}
            >
              <option value="both">שניהם</option>
              <option value="gregorian">לועזי</option>
              <option value="hebrew">עברי</option>
            </select>
          </div>
        </div>
      </PageHeader>

      <DashboardContent dashboardState={dashboardState} viewMode={viewMode} />
    </>
  );
}

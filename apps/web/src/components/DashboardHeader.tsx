import { SidebarNav } from './SidebarNav';

type DashboardHeaderProps = {
  onMenuToggle: () => void;
  mobileMenuOpen: boolean;
};

export function DashboardHeader({ onMenuToggle, mobileMenuOpen }: DashboardHeaderProps) {
  return (
    <header className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 lg:hidden"
            aria-label="פתח תפריט"
          >
            ☰
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-600 text-lg font-semibold text-white">
            N
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">Nera</p>
            <p className="text-sm text-slate-500">פלטפורמת ארגון חכמה</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 sm:min-w-[280px]">
            <span>🔍</span>
            <input className="w-full bg-transparent outline-none" placeholder="חיפוש מהיר" />
          </label>
          <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700">
            🔔
            <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500" />
          </button>
          <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-3 text-sm font-medium text-slate-700">
            עזרה
          </button>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              אי
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">אדם ישראלי</p>
              <p className="text-xs text-slate-500">מנהל מערכת</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">ארגון נוכחי:</span> ארגון ראשי
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">מצב עבודה רגיל</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">בטוח</span>
        </div>
      </div>

      <div className={`mt-4 ${mobileMenuOpen ? 'block' : 'hidden'} lg:hidden`}>
        <SidebarNav />
      </div>
    </header>
  );
}

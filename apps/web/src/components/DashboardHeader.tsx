import { SidebarNav } from './SidebarNav';

type DashboardHeaderProps = {
  user: { name: string; role: string };
  organization: { id: string; name: string };
  onMenuToggle: () => void;
  mobileMenuOpen: boolean;
  onNotificationsToggle: () => void;
  onSearchToggle: () => void;
  onHelpClick: () => void;
  onOrganizationChange: (organizationId: string) => void;
  onLogout: () => void;
  viewMode: 'gregorian' | 'hebrew' | 'both';
  onViewModeChange: (value: 'gregorian' | 'hebrew' | 'both') => void;
};

export function DashboardHeader({
  user,
  organization,
  onMenuToggle,
  mobileMenuOpen,
  onNotificationsToggle,
  onSearchToggle,
  onHelpClick,
  onOrganizationChange,
  onLogout,
  viewMode,
  onViewModeChange,
}: DashboardHeaderProps) {
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
          <button type="button" onClick={onSearchToggle} className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 sm:min-w-[280px]">
            <span>🔍</span>
            <span className="w-full text-right">חיפוש מהיר</span>
          </button>
          <button type="button" onClick={onNotificationsToggle} className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700">
            🔔
            <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500" />
          </button>
          <button type="button" onClick={onHelpClick} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-3 text-sm font-medium text-slate-700">
            עזרה
          </button>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {user.name.charAt(0)}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">ארגון נוכחי:</span>
          <span>{organization.name}</span>
          <select className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm" value={organization.id} onChange={(event) => onOrganizationChange(event.target.value)}>
            <option value="org-main">ארגון ראשי</option>
            <option value="org-jerusalem">מוסד ירושלים</option>
            <option value="org-bnei-brak">סניף בני ברק</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <select className="rounded-full border border-slate-200 bg-white px-3 py-1" value={viewMode} onChange={(event) => onViewModeChange(event.target.value as 'gregorian' | 'hebrew' | 'both')}>
            <option value="both">שניהם</option>
            <option value="gregorian">לועזי</option>
            <option value="hebrew">עברי</option>
          </select>
          <button type="button" onClick={onLogout} className="rounded-full bg-slate-900 px-3 py-1 text-white">יציאה</button>
        </div>
      </div>

      <div className={`mt-4 ${mobileMenuOpen ? 'block' : 'hidden'} lg:hidden`}>
        <SidebarNav />
      </div>
    </header>
  );
}

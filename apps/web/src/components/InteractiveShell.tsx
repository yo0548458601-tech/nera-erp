'use client';

import { useEffect, useMemo, useState } from 'react';
import { demoOrganizations, demoUser } from '../lib/auth/demoData';
import { type AuthSession } from '../lib/auth/demoAuth';
import { DashboardContent } from './DashboardContent';
import { DashboardHeader } from './DashboardHeader';
import { SidebarNav } from './SidebarNav';

type InteractiveShellProps = {
  session: AuthSession;
  onLogout: () => void;
  onOrganizationChange: (organizationId: string) => void;
};

export function InteractiveShell({ session, onLogout, onOrganizationChange }: InteractiveShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(session.selectedOrganizationId);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'מסמך ממתין לאישור', body: 'מסמך חדש זקוק לאישור מנהל', unread: true },
    { id: 2, title: 'משימה מתקרבת למועד', body: 'המשימה “סקירת דיווח” עומדת להסתיים היום', unread: true },
    { id: 3, title: 'אירוע חדש נוסף ליומן', body: 'הוזמן אירוע צוות לשעה 16:30', unread: false },
  ]);
  const [viewMode, setViewMode] = useState<'gregorian' | 'hebrew' | 'both'>('both');
  const [dashboardState, setDashboardState] = useState<'loading' | 'ready' | 'empty' | 'error'>('ready');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setSearchOpen(false);
        setQuickActionsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setToastMessage(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const selectedOrganization = useMemo(
    () => demoOrganizations.find((organization) => organization.id === selectedOrganizationId) ?? demoOrganizations[0],
    [selectedOrganizationId],
  );

  const handleOrganizationChange = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    onOrganizationChange(organizationId);
    setToastMessage(`הארגון הוחלף ל${demoOrganizations.find((item) => item.id === organizationId)?.name ?? ''}`);
  };

  const markAllAsRead = () => {
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  };

  const markOneAsRead = (id: number) => {
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  };

  const handleQuickAction = (type: string) => {
    setQuickActionsOpen(false);
    setToastMessage(`הפעולה “${type}” נבחרה. בשלב זה היא מציגה רק ממשק תצוגה.`);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff,_#f2f5f9_55%,_#eef2f7)] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <DashboardHeader
          user={demoUser}
          organization={selectedOrganization}
          onMenuToggle={() => setMobileMenuOpen((value) => !value)}
          mobileMenuOpen={mobileMenuOpen}
          onNotificationsToggle={() => setNotificationsOpen((value) => !value)}
          onSearchToggle={() => setSearchOpen((value) => !value)}
          onHelpClick={() => setToastMessage('עזרה תתמוך בעתיד בפעולות מערכת.')}
          onOrganizationChange={handleOrganizationChange}
          onLogout={onLogout}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="hidden lg:block">
            <SidebarNav />
          </aside>

          <main className="flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-slate-900">מצב הדגמה</p>
                <p className="text-sm text-slate-500">המערכת נפתחת בסביבה מקומית בלבד ללא כתיבה למסד.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setDashboardState('loading')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">טעינה</button>
                <button type="button" onClick={() => setDashboardState('empty')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">ריק</button>
                <button type="button" onClick={() => setDashboardState('error')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">שגיאה</button>
                <button type="button" onClick={() => setDashboardState('ready')} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm text-cyan-700">מוכן</button>
              </div>
            </div>

            <DashboardContent dashboardState={dashboardState} viewMode={viewMode} />
          </main>
        </div>
      </div>

      {notificationsOpen ? (
        <div className="fixed left-4 top-24 z-40 w-[min(90vw,360px)] rounded-[24px] border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">התראות</h3>
            <button type="button" onClick={markAllAsRead} className="text-sm text-cyan-700">סמן הכל כנקראו</button>
          </div>
          <div className="mt-4 space-y-3">
            {notifications.length === 0 ? <p className="text-sm text-slate-500">אין התראות חדשות.</p> : notifications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.body}</p>
                  </div>
                  {item.unread ? <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] text-white">חדש</span> : null}
                </div>
                <button type="button" onClick={() => markOneAsRead(item.id)} className="mt-2 text-sm text-cyan-700">
                  סמן כנקרא
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="fixed left-1/2 top-24 z-40 w-[min(92vw,560px)] -translate-x-1/2 rounded-[24px] border border-slate-200 bg-white p-4 shadow-2xl">
          <label className="block text-sm font-semibold text-slate-900">חיפוש מהיר</label>
          <input className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" placeholder="חיפוש בפאנל, פעולות ומהירות" />
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-3">לוחות מחוונים</div>
            <div className="rounded-2xl bg-slate-50 p-3">ניהול ארגונים</div>
            <div className="rounded-2xl bg-slate-50 p-3">משימות</div>
          </div>
        </div>
      ) : null}

      {quickActionsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">פעולות מהירות</h3>
              <button type="button" onClick={() => setQuickActionsOpen(false)} className="text-sm text-slate-500">סגור</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'יצירת משימה', action: 'יצירת משימה' },
                { label: 'יצירת אירוע', action: 'יצירת אירוע' },
                { label: 'העלאת מסמך', action: 'העלאת מסמך' },
                { label: 'הוספת לקוח', action: 'הוספת לקוח' },
              ].map((item) => (
                <button key={item.label} type="button" onClick={() => handleQuickAction(item.action)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-medium text-slate-700">
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}

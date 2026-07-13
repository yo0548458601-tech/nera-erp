'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { demoOrganizations } from '../../lib/auth/demoData';
import { useSession } from '../../context/SessionContext';
import { useDismissableOverlay } from '../../hooks/useDismissableOverlay';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { findNavMatch } from '../../config/navigation';
import { AppSidebar } from './AppSidebar';
import { MobileNavigation } from './MobileNavigation';
import { AppHeader } from './AppHeader';

type OverlayPanel = 'mobileMenu' | 'notifications' | 'search' | 'quickActions' | 'userMenu' | 'orgSwitcher';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'nera:sidebar-collapsed';

type AppShellProps = {
  children: ReactNode;
};

/**
 * The application shell used by every authenticated route: sidebar, mobile
 * drawer, header and the shared overlay panels (search / notifications /
 * quick actions), plus the routed page content in <main>. Only one overlay
 * panel may be open at a time by construction (single `openPanel` state).
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { session, logout, selectOrganization } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorageState(SIDEBAR_COLLAPSED_STORAGE_KEY, false);

  const [openPanel, setOpenPanel] = useState<OverlayPanel | null>(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'מסמך ממתין לאישור', body: 'מסמך חדש זקוק לאישור מנהל', unread: true },
    { id: 2, title: 'משימה מתקרבת למועד', body: 'המשימה “סקירת דיווח” עומדת להסתיים היום', unread: true },
    { id: 3, title: 'אירוע חדש נוסף ליומן', body: 'הוזמן אירוע צוות לשעה 16:30', unread: false },
  ]);
  const [toastMessage, setToastMessage] = useState('');

  const togglePanel = useCallback((panel: OverlayPanel) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  }, []);
  const closePanel = useCallback(() => setOpenPanel(null), []);

  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const quickActionsPanelRef = useRef<HTMLDivElement>(null);
  const quickActionsTriggerRef = useRef<HTMLButtonElement>(null);

  useDismissableOverlay(openPanel === 'notifications', closePanel, [notificationsPanelRef, notificationsTriggerRef], {
    restoreFocusRef: notificationsTriggerRef,
  });
  useDismissableOverlay(openPanel === 'search', closePanel, [searchPanelRef, searchTriggerRef], {
    restoreFocusRef: searchTriggerRef,
  });
  useDismissableOverlay(openPanel === 'quickActions', closePanel, [quickActionsPanelRef, quickActionsTriggerRef], {
    restoreFocusRef: quickActionsTriggerRef,
  });

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2200);
  }, []);

  const selectedOrganization = useMemo(
    () => demoOrganizations.find((organization) => organization.id === session?.selectedOrganizationId) ?? demoOrganizations[0],
    [session?.selectedOrganizationId],
  );

  const pageTitle = useMemo(() => findNavMatch(pathname)?.item.label ?? 'Nera', [pathname]);

  const handleOrganizationChange = (organizationId: string) => {
    selectOrganization(organizationId);
    showToast(`הארגון הוחלף ל${demoOrganizations.find((item) => item.id === organizationId)?.name ?? ''}`);
  };

  const markAllAsRead = () => {
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  };

  const markOneAsRead = (id: number) => {
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  };

  const handleQuickAction = (type: string) => {
    closePanel();
    showToast(`הפעולה “${type}” נבחרה. בשלב זה היא מציגה רק ממשק תצוגה.`);
  };

  if (!session) {
    return null;
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff,_#f2f5f9_55%,_#eef2f7)] text-slate-900">
      <AppSidebar
        pathname={pathname}
        organizationName={selectedOrganization.name}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <MobileNavigation
        open={openPanel === 'mobileMenu'}
        onClose={closePanel}
        pathname={pathname}
        organizationName={selectedOrganization.name}
        triggerRef={mobileMenuTriggerRef}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          pageTitle={pageTitle}
          user={session.user}
          organization={selectedOrganization}
          organizations={demoOrganizations}
          mobileMenuOpen={openPanel === 'mobileMenu'}
          onMobileMenuToggle={() => togglePanel('mobileMenu')}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
          notificationsOpen={openPanel === 'notifications'}
          onNotificationsToggle={() => togglePanel('notifications')}
          notificationsTriggerRef={notificationsTriggerRef}
          searchOpen={openPanel === 'search'}
          onSearchToggle={() => togglePanel('search')}
          searchTriggerRef={searchTriggerRef}
          quickActionsOpen={openPanel === 'quickActions'}
          onQuickActionsToggle={() => togglePanel('quickActions')}
          quickActionsTriggerRef={quickActionsTriggerRef}
          userMenuOpen={openPanel === 'userMenu'}
          onUserMenuToggle={() => togglePanel('userMenu')}
          orgSwitcherOpen={openPanel === 'orgSwitcher'}
          onOrgSwitcherToggle={() => togglePanel('orgSwitcher')}
          onPanelClose={closePanel}
          onHelpClick={() => showToast('עזרה תתמוך בעתיד בפעולות מערכת.')}
          onOrganizationChange={handleOrganizationChange}
          onLogout={logout}
        />

        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">{children}</main>
      </div>

      {openPanel === 'notifications' ? (
        <div
          ref={notificationsPanelRef}
          className="fixed left-4 top-24 z-40 w-[min(90vw,360px)] rounded-[24px] border border-slate-200 bg-white p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">התראות</h3>
            <button type="button" onClick={markAllAsRead} className="text-sm text-cyan-700">
              סמן הכל כנקראו
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">אין התראות חדשות.</p>
            ) : (
              notifications.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.body}</p>
                    </div>
                    {item.unread ? (
                      <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] text-white">חדש</span>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => markOneAsRead(item.id)} className="mt-2 text-sm text-cyan-700">
                    סמן כנקרא
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {openPanel === 'search' ? (
        <div
          ref={searchPanelRef}
          className="fixed left-1/2 top-24 z-40 w-[min(92vw,560px)] -translate-x-1/2 rounded-[24px] border border-slate-200 bg-white p-4 shadow-2xl"
        >
          <label className="block text-sm font-semibold text-slate-900">חיפוש מהיר</label>
          <input
            autoFocus
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            placeholder="חיפוש בפאנל, פעולות ומהירות"
          />
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-3">לוחות מחוונים</div>
            <div className="rounded-2xl bg-slate-50 p-3">ניהול ארגונים</div>
            <div className="rounded-2xl bg-slate-50 p-3">משימות</div>
          </div>
        </div>
      ) : null}

      {openPanel === 'quickActions' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div ref={quickActionsPanelRef} className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">פעולות מהירות</h3>
              <button type="button" onClick={closePanel} className="text-sm text-slate-500">
                סגור
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'יצירת משימה', action: 'יצירת משימה' },
                { label: 'יצירת אירוע', action: 'יצירת אירוע' },
                { label: 'העלאת מסמך', action: 'העלאת מסמך' },
                { label: 'הוספת לקוח', action: 'הוספת לקוח' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleQuickAction(item.action)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-medium text-slate-700"
                >
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

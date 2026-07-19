'use client';

import { useRef, type RefObject } from 'react';
import Link from 'next/link';
import {
  Bell,
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { type DemoOrganization, type DemoUser } from '../../lib/auth/demoData';
import { useDismissableOverlay } from '../../hooks/useDismissableOverlay';

type AppHeaderProps = {
  pageTitle: string;
  user: DemoUser;
  organization: DemoOrganization;
  organizations: DemoOrganization[];
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  mobileMenuTriggerRef: RefObject<HTMLButtonElement>;
  notificationsOpen: boolean;
  onNotificationsToggle: () => void;
  notificationsTriggerRef: RefObject<HTMLButtonElement>;
  searchOpen: boolean;
  onSearchToggle: () => void;
  searchTriggerRef: RefObject<HTMLButtonElement>;
  quickActionsOpen: boolean;
  onQuickActionsToggle: () => void;
  quickActionsTriggerRef: RefObject<HTMLButtonElement>;
  userMenuOpen: boolean;
  onUserMenuToggle: () => void;
  orgSwitcherOpen: boolean;
  onOrgSwitcherToggle: () => void;
  onPanelClose: () => void;
  onHelpClick: () => void;
  onOrganizationChange: (organizationId: string) => void;
  onLogout: () => void;
};

/**
 * Application-wide header. Data (user, organization, organizations) is
 * always supplied by the caller (AppShell, backed by SessionContext) -
 * this component never imports demo data directly.
 */
export function AppHeader({
  pageTitle,
  user,
  organization,
  organizations,
  mobileMenuOpen,
  onMobileMenuToggle,
  mobileMenuTriggerRef,
  notificationsOpen,
  onNotificationsToggle,
  notificationsTriggerRef,
  searchOpen,
  onSearchToggle,
  searchTriggerRef,
  quickActionsOpen,
  onQuickActionsToggle,
  quickActionsTriggerRef,
  userMenuOpen,
  onUserMenuToggle,
  orgSwitcherOpen,
  onOrgSwitcherToggle,
  onPanelClose,
  onHelpClick,
  onOrganizationChange,
  onLogout,
}: AppHeaderProps) {
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuPanelRef = useRef<HTMLDivElement>(null);
  const orgSwitcherTriggerRef = useRef<HTMLButtonElement>(null);
  const orgSwitcherPanelRef = useRef<HTMLDivElement>(null);

  useDismissableOverlay(userMenuOpen, onPanelClose, [userMenuPanelRef, userMenuTriggerRef], {
    restoreFocusRef: userMenuTriggerRef,
  });
  useDismissableOverlay(
    orgSwitcherOpen,
    onPanelClose,
    [orgSwitcherPanelRef, orgSwitcherTriggerRef],
    {
      restoreFocusRef: orgSwitcherTriggerRef,
    }
  );

  return (
    <header className="border-b border-slate-200 bg-white/90 p-4 backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            onClick={onMobileMenuToggle}
            aria-haspopup="true"
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 lg:hidden"
            aria-label="פתח תפריט ניווט"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-lg font-semibold text-white">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">{pageTitle}</p>
            <p className="text-sm text-slate-500">Nera · פלטפורמת ארגון חכמה</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={onSearchToggle}
            aria-haspopup="true"
            aria-expanded={searchOpen}
            className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 sm:min-w-[280px] sm:flex-none"
          >
            <Search size={16} aria-hidden="true" />
            <span className="hidden w-full text-right sm:inline">חיפוש מהיר</span>
          </button>
          <button
            ref={notificationsTriggerRef}
            type="button"
            onClick={onNotificationsToggle}
            aria-haspopup="true"
            aria-expanded={notificationsOpen}
            aria-label="התראות"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700"
          >
            <Bell size={18} aria-hidden="true" />
            <span
              className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500"
              aria-hidden="true"
            />
          </button>
          <button
            ref={quickActionsTriggerRef}
            type="button"
            onClick={onQuickActionsToggle}
            aria-haspopup="true"
            aria-expanded={quickActionsOpen}
            className="hidden h-11 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3 text-sm font-medium text-slate-700 md:inline-flex"
          >
            <Plus size={16} aria-hidden="true" />
            פעולות מהירות
          </button>
          <button
            type="button"
            onClick={onHelpClick}
            aria-label="עזרה"
            className="hidden h-11 items-center justify-center rounded-2xl border border-slate-200 px-3 text-sm font-medium text-slate-700 md:inline-flex"
          >
            <HelpCircle size={18} aria-hidden="true" />
          </button>

          <div className="relative">
            <button
              ref={userMenuTriggerRef}
              type="button"
              onClick={onUserMenuToggle}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right transition hover:border-cyan-200 hover:bg-cyan-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {user.name.charAt(0)}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role}</p>
              </div>
            </button>

            {userMenuOpen ? (
              <div
                ref={userMenuPanelRef}
                role="menu"
                className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
              >
                <div className="border-b border-slate-100 px-1 pb-3">
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                </div>
                <Link
                  role="menuitem"
                  href="/settings"
                  onClick={onPanelClose}
                  className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-sm text-slate-700 hover:bg-slate-50"
                >
                  <ShieldCheck size={14} aria-hidden="true" />
                  הרשאות משתמשים (הדגמה)
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={onPanelClose}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-right text-sm text-slate-700 hover:bg-slate-50"
                >
                  הגדרות פרופיל
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={onLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut size={14} aria-hidden="true" />
                  יציאה
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">ארגון נוכחי:</span>
          <div className="relative">
            <button
              ref={orgSwitcherTriggerRef}
              type="button"
              onClick={onOrgSwitcherToggle}
              aria-haspopup="listbox"
              aria-expanded={orgSwitcherOpen}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
            >
              <span>{organization.name}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            {orgSwitcherOpen ? (
              <div
                ref={orgSwitcherPanelRef}
                role="listbox"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
              >
                {organizations.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={item.id === organization.id}
                    onClick={() => {
                      onOrganizationChange(item.id);
                      onPanelClose();
                    }}
                    className={`block w-full rounded-xl px-3 py-2 text-right text-sm ${
                      item.id === organization.id
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full bg-slate-900 px-3 py-1 text-sm text-white"
        >
          יציאה
        </button>
      </div>
    </header>
  );
}

'use client';

import { useState } from 'react';
import { Building2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavList } from './NavList';

type AppSidebarProps = {
  pathname: string;
  organizationName: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

/** Desktop, RTL, persistent sidebar with an expanded and a collapsed (icon-rail) mode. */
export function AppSidebar({ pathname, organizationName, collapsed, onToggleCollapsed }: AppSidebarProps) {
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-l border-slate-200 bg-white lg:flex ${
        collapsed ? 'w-20' : 'w-72'
      } transition-[width] duration-150`}
    >
      <div className={`flex items-center gap-2 border-b border-slate-100 p-4 ${collapsed ? 'justify-center' : ''}`}>
        <Building2 size={18} className="shrink-0 text-cyan-700" aria-hidden="true" />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{organizationName}</p>
            <p className="text-xs text-slate-400">ארגון פעיל</p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <NavList
          pathname={pathname}
          railMode={collapsed}
          collapsedSectionIds={collapsedSectionIds}
          onToggleSection={toggleSection}
        />
      </div>

      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'הרחב תפריט ניווט' : 'כווץ תפריט ניווט'}
          title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
          {!collapsed ? <span>כווץ תפריט</span> : null}
        </button>
      </div>
    </aside>
  );
}

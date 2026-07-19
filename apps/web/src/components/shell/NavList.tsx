'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { navigationSections, isNavItemActive } from '../../config/navigation';
import { getNavIcon } from '../../config/navigationIcons';

type NavListProps = {
  pathname: string;
  /** Icon-only rail mode. Only meaningful for the desktop sidebar. */
  railMode?: boolean;
  collapsedSectionIds: ReadonlySet<string>;
  onToggleSection: (sectionId: string) => void;
  /** Called after a link is activated - used to close the mobile drawer. */
  onNavigate?: () => void;
};

/**
 * Renders the full navigation tree from the shared navigation config. Used
 * by both the desktop AppSidebar and the MobileNavigation drawer so the
 * navigation data and active-state logic exist in exactly one place.
 */
export function NavList({
  pathname,
  railMode = false,
  collapsedSectionIds,
  onToggleSection,
  onNavigate,
}: NavListProps) {
  if (railMode) {
    return (
      <nav aria-label="ניווט ראשי" className="flex flex-col items-center gap-1 py-2">
        {navigationSections.map((section, sectionIndex) => (
          <div key={section.id} className="flex w-full flex-col items-center gap-1">
            {sectionIndex > 0 ? (
              <div className="my-1 h-px w-8 bg-slate-200" aria-hidden="true" />
            ) : null}
            {section.items.map(item => {
              const Icon = getNavIcon(item.icon);
              const active = isNavItemActive(item, pathname);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                    active ? 'bg-cyan-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="ניווט ראשי" className="flex flex-col gap-4">
      {navigationSections.map(section => {
        const isSectionCollapsed = collapsedSectionIds.has(section.id);

        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => onToggleSection(section.id)}
              aria-expanded={!isSectionCollapsed}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
            >
              <span>{section.label}</span>
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`transition-transform ${isSectionCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            {!isSectionCollapsed ? (
              <div className="mt-1 flex flex-col gap-0.5">
                {section.items.map(item => {
                  const Icon = getNavIcon(item.icon);
                  const active = isNavItemActive(item, pathname);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active ? 'bg-cyan-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

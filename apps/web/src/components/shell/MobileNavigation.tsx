'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import { useDismissableOverlay } from '../../hooks/useDismissableOverlay';
import { NavList } from './NavList';

type MobileNavigationProps = {
  open: boolean;
  onClose: () => void;
  pathname: string;
  organizationName: string;
  triggerRef: RefObject<HTMLButtonElement>;
};

/** Mobile drawer replacement for the desktop sidebar, sliding in from the RTL start (right) edge. */
export function MobileNavigation({
  open,
  onClose,
  pathname,
  organizationName,
  triggerRef,
}: MobileNavigationProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  useDismissableOverlay(open, onClose, [panelRef, triggerRef], { restoreFocusRef: triggerRef });

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSectionIds(current => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="ניווט"
        className="absolute inset-y-0 right-0 flex w-[min(85vw,320px)] flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{organizationName}</p>
            <p className="text-xs text-slate-400">ארגון פעיל</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור ניווט"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <NavList
            pathname={pathname}
            collapsedSectionIds={collapsedSectionIds}
            onToggleSection={toggleSection}
            onNavigate={onClose}
          />
        </div>
      </div>
    </div>
  );
}

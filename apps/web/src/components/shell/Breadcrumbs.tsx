'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getBreadcrumbTrail } from '../../config/navigation';

/**
 * Derives its breadcrumb trail from the current route and the navigation
 * config, so individual pages never need to hardcode their own breadcrumbs.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const trail = getBreadcrumbTrail(pathname);

  if (trail.length === 0) {
    return null;
  }

  return (
    <nav aria-label="ניתוב" className="flex items-center gap-1 text-sm text-slate-500">
      {trail.map((crumb, index) => {
        const isLast = index === trail.length - 1;
        const isLinkable = Boolean(crumb.href) && !isLast;

        return (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronLeft size={14} aria-hidden="true" className="text-slate-300" /> : null}
            {isLinkable ? (
              <Link href={crumb.href as string} className="rounded px-1 hover:text-cyan-700 hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'font-medium text-slate-700' : ''}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

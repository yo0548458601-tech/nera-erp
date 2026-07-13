'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { findNavMatch } from '../../config/navigation';
import { Breadcrumbs } from './Breadcrumbs';
import { PageActions } from './PageActions';

type PageHeaderProps = {
  /** Defaults to the current route's label from the navigation config. */
  title?: string;
  subtitle?: string;
  helpText?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** Optional extra content rendered below the title row, e.g. filters. */
  children?: ReactNode;
};

/**
 * Consistent page-level header used by every route: breadcrumbs, title,
 * optional subtitle/help text and action slots. Pages should render this
 * instead of duplicating title/breadcrumb markup themselves.
 */
export function PageHeader({ title, subtitle, helpText, primaryAction, secondaryActions, children }: PageHeaderProps) {
  const pathname = usePathname();
  const resolvedTitle = title ?? findNavMatch(pathname)?.item.label ?? '';

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Breadcrumbs />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{resolvedTitle}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          {helpText ? <p className="mt-2 text-xs text-slate-400">{helpText}</p> : null}
        </div>
        <PageActions primary={primaryAction} secondary={secondaryActions} />
      </div>
      {children}
    </div>
  );
}

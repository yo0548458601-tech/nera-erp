import { type ReactNode } from 'react';

type PageActionsProps = {
  primary?: ReactNode;
  secondary?: ReactNode;
};

/** A small, consistent slot for a page's primary and secondary actions. */
export function PageActions({ primary, secondary }: PageActionsProps) {
  if (!primary && !secondary) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {secondary}
      {primary}
    </div>
  );
}

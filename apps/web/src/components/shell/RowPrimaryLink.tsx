import Link from 'next/link';
import { type ReactNode } from 'react';

type RowPrimaryLinkProps = {
  href: string;
  label: string;
  children: ReactNode;
};

/**
 * A row's real, keyboard-accessible navigation target, meant to be used
 * together with useRowClickNavigate on the ancestor <tr> (which extends
 * the same navigation to mouse clicks anywhere else on the row). A
 * genuine <Link>, so Tab focuses it and Enter activates it natively -
 * no custom key handling, no clickable <div>, no nested links/buttons.
 */
export function RowPrimaryLink({ href, label, children }: RowPrimaryLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    >
      {children}
    </Link>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { type MouseEvent } from 'react';

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="option"], [contenteditable="true"]';

/**
 * Reusable row-navigation pattern for any future table. Call this hook
 * once per table (it must stay at the top level, not inside a .map()),
 * then use the returned factory to build each row's onClick handler.
 *
 * Clicks starting inside any other interactive descendant (links,
 * buttons, checkboxes, menus, inputs) are ignored, so those controls keep
 * working without also triggering navigation. The row itself stays real,
 * semantic <tr>/<td> markup - no clickable <div>. Keyboard access is
 * provided separately by rendering a genuine <Link> for the row's primary
 * cell (see RowPrimaryLink) so Tab and Enter work natively, with no
 * custom key handling or ARIA role overrides needed on the row.
 */
export function useRowClickNavigate() {
  const router = useRouter();

  return (href: string) => (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) {
      return;
    }
    router.push(href);
  };
}

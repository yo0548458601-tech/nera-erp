'use client';

import { useEffect, useState } from 'react';

export type PageSizeOption = 10 | 25 | 50 | 100 | 'unlimited';

export const PAGE_SIZE_OPTIONS: PageSizeOption[] = [10, 25, 50, 100, 'unlimited'];

function isValidPageSize(value: unknown): value is PageSizeOption {
  return (
    value === 'unlimited' ||
    (typeof value === 'number' && PAGE_SIZE_OPTIONS.includes(value as PageSizeOption))
  );
}

/**
 * A reusable rows-per-page preference, persisted to localStorage per
 * storageKey (so each list/screen remembers its own choice independently -
 * demo-mode only, resets are limited to this browser). Any future list can
 * adopt page-size control by calling this hook with its own key and
 * rendering <PageSizeSelect />; no list needs to reinvent pagination-size
 * state or storage.
 */
export function usePageSize(
  storageKey: string,
  defaultValue: PageSizeOption = 25
): [PageSizeOption, (value: PageSizeOption) => void] {
  const [pageSize, setPageSizeState] = useState<PageSizeOption>(defaultValue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) {
        return;
      }
      const parsed = stored === 'unlimited' ? 'unlimited' : Number(stored);
      if (isValidPageSize(parsed)) {
        setPageSizeState(parsed);
      }
    } catch {
      // localStorage may be unavailable; fall back to the in-memory default.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setPageSize = (value: PageSizeOption) => {
    setPageSizeState(value);
    try {
      window.localStorage.setItem(storageKey, String(value));
    } catch {
      // Ignore storage failures; the preference simply won't persist.
    }
  };

  return [pageSize, setPageSize];
}

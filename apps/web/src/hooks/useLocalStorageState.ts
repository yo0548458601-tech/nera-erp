'use client';

import { useEffect, useState } from 'react';

/**
 * A small client-side preference hook: behaves like useState, but persists
 * the value to localStorage under the given key and restores it on mount.
 * Kept deliberately minimal - no global state library is introduced for
 * what is a single piece of local UI preference (see TECH_STACK.md, which
 * does not list a state-management library for this kind of concern).
 */
export function useLocalStorageState(
  key: string,
  defaultValue: boolean
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        setValue(stored === 'true');
      }
    } catch {
      // localStorage may be unavailable; fall back to the in-memory default.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (next: boolean) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      // Ignore storage failures; the preference simply won't persist.
    }
  };

  return [value, update];
}

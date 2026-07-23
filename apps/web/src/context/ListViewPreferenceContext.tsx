'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { type EffectiveListViewColumns } from '@nera/customization-engine';
import { useSession } from './SessionContext';
import { DEMO_SYSTEM_ROLE_ID } from '../lib/auth/demoIdentity';
import {
  getEffectiveListViewColumnsAction,
  resetMyListViewColumnsAction,
  setMyListViewColumnsAction,
  setSystemDefaultListViewColumnsAction,
} from '../lib/actions/listViewPreferenceActions';

type ListViewPreferenceContextValue = {
  /**
   * Resolves the effective visible/ordered columns for a screen (user ->
   * role -> institution -> system -> built-in-default precedence, now
   * resolved against real, persisted rows - P013A). Synchronous: returns
   * the built-in default until the real value has loaded, then the real
   * value on every subsequent call/render once the background fetch
   * (triggered by this same call) resolves.
   */
  getEffectiveColumns: (
    screenId: string,
    builtInDefaultColumnKeys: string[]
  ) => EffectiveListViewColumns;
  /** Sets the signed-in user's own column preference for a screen (user scope). */
  setMyColumns: (screenId: string, visibleColumnKeys: string[]) => void;
  /** Clears the signed-in user's own preference, falling back to the next broader scope. */
  resetMyColumns: (screenId: string) => void;
  /** Administrator action: sets the system-wide default for a screen. */
  setSystemDefaultColumns: (
    screenId: string,
    visibleColumnKeys: string[],
    updatedByUserId: string
  ) => void;
};

const ListViewPreferenceContext = createContext<ListViewPreferenceContextValue | undefined>(
  undefined
);

/**
 * Real, persisted list-view column preferences (P013A - Owner-approved:
 * List View Preferences persist in P013A, unlike Custom Fields/Field
 * Requirements). No in-memory `rules` array anymore - every read/write goes
 * through `listViewPreferenceActions.ts`'s Server Actions.
 */
export function ListViewPreferenceProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const organizationId = session?.selectedOrganizationId;
  const [cache, setCache] = useState<Record<string, EffectiveListViewColumns>>({});
  const inFlight = useRef<Set<string>>(new Set());

  const getEffectiveColumns = useCallback(
    (screenId: string, builtInDefaultColumnKeys: string[]): EffectiveListViewColumns => {
      const cached = cache[screenId];
      if (!organizationId) {
        return (
          cached ?? { screenId, visibleColumnKeys: builtInDefaultColumnKeys, source: 'default' }
        );
      }

      if (!cached && !inFlight.current.has(screenId)) {
        inFlight.current.add(screenId);
        // institutionId is deliberately `undefined`: no "current institution"
        // selection exists anywhere in the session yet (Institution is a real,
        // separate model per ADR-002, but nothing in this sprint lets a user
        // pick one) - this previously passed `organizationId` again by
        // mistake, which is a different id entirely and could never resolve
        // a real institution-scoped row.
        getEffectiveListViewColumnsAction(
          organizationId,
          screenId,
          [DEMO_SYSTEM_ROLE_ID],
          /* institutionId */ undefined,
          builtInDefaultColumnKeys
        )
          .then(result => {
            setCache(current => ({ ...current, [screenId]: result }));
          })
          .finally(() => {
            inFlight.current.delete(screenId);
          });
      }

      return cached ?? { screenId, visibleColumnKeys: builtInDefaultColumnKeys, source: 'default' };
    },
    [cache, organizationId]
  );

  const setMyColumns = useCallback(
    (screenId: string, visibleColumnKeys: string[]) => {
      if (!organizationId) {
        return;
      }
      setMyListViewColumnsAction(organizationId, screenId, visibleColumnKeys).then(result => {
        if (result.ok) {
          setCache(current => ({
            ...current,
            [screenId]: { screenId, visibleColumnKeys, source: 'user' },
          }));
        }
      });
    },
    [organizationId]
  );

  const resetMyColumns = useCallback(
    (screenId: string) => {
      if (!organizationId) {
        return;
      }
      resetMyListViewColumnsAction(organizationId, screenId).then(result => {
        if (result.ok) {
          setCache(current => {
            const next = { ...current };
            delete next[screenId];
            return next;
          });
        }
      });
    },
    [organizationId]
  );

  const setSystemDefaultColumns = useCallback(
    (screenId: string, visibleColumnKeys: string[], _updatedByUserId: string) => {
      if (!organizationId) {
        return;
      }
      setSystemDefaultListViewColumnsAction(organizationId, screenId, visibleColumnKeys).then(
        result => {
          if (result.ok) {
            setCache(current => ({
              ...current,
              [screenId]: { screenId, visibleColumnKeys, source: 'system' },
            }));
          }
        }
      );
    },
    [organizationId]
  );

  const value = useMemo<ListViewPreferenceContextValue>(
    () => ({ getEffectiveColumns, setMyColumns, resetMyColumns, setSystemDefaultColumns }),
    [getEffectiveColumns, setMyColumns, resetMyColumns, setSystemDefaultColumns]
  );

  return (
    <ListViewPreferenceContext.Provider value={value}>
      {children}
    </ListViewPreferenceContext.Provider>
  );
}

export function useListViewPreferences(): ListViewPreferenceContextValue {
  const context = useContext(ListViewPreferenceContext);
  if (!context) {
    throw new Error('useListViewPreferences must be used within a ListViewPreferenceProvider');
  }
  return context;
}

'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  resolveEffectiveListViewColumns,
  type EffectiveListViewColumns,
  type ListViewColumnPreference,
} from '@nera/customization-engine';
import { useSession } from './SessionContext';
import { demoSystemUsers } from '../lib/authorization/demoUsers';

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type ListViewPreferenceContextValue = {
  rules: ListViewColumnPreference[];
  /** Resolves the effective visible/ordered columns for a screen, following the user -> role -> institution -> system -> built-in-default precedence. */
  getEffectiveColumns: (screenId: string, builtInDefaultColumnKeys: string[]) => EffectiveListViewColumns;
  /** Sets the signed-in user's own column preference for a screen (user scope). */
  setMyColumns: (screenId: string, visibleColumnKeys: string[]) => void;
  /** Clears the signed-in user's own preference, falling back to the next broader scope. */
  resetMyColumns: (screenId: string) => void;
  /** Administrator action: sets the system-wide default for a screen. */
  setSystemDefaultColumns: (screenId: string, visibleColumnKeys: string[], updatedByUserId: string) => void;
};

const ListViewPreferenceContext = createContext<ListViewPreferenceContextValue | undefined>(undefined);

/**
 * Holds configurable list-view column preferences across the same
 * system/institution/role/user precedence used by AuthorizationContext,
 * reusing @nera/customization-engine's resolveEffectiveListViewColumns.
 * Demo-only, in-memory - see that engine module's docstring for why this
 * precedence pattern is intentionally shared rather than reinvented.
 */
export function ListViewPreferenceProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [rules, setRules] = useState<ListViewColumnPreference[]>([]);

  const currentUserId = session?.user.id ?? 'demo-user';
  const currentRoleIds = useMemo(() => demoSystemUsers.find((user) => user.id === currentUserId)?.roleIds ?? [], [currentUserId]);
  const currentInstitutionId = session?.selectedOrganizationId;

  const getEffectiveColumns = useCallback(
    (screenId: string, builtInDefaultColumnKeys: string[]): EffectiveListViewColumns =>
      resolveEffectiveListViewColumns(
        screenId,
        { userId: currentUserId, roleIds: currentRoleIds, institutionId: currentInstitutionId },
        rules,
        builtInDefaultColumnKeys,
      ),
    [rules, currentUserId, currentRoleIds, currentInstitutionId],
  );

  const upsertRule = useCallback((scope: ListViewColumnPreference['scope'], targetId: string | undefined, screenId: string, visibleColumnKeys: string[], updatedByUserId: string) => {
    setRules((current) => {
      const withoutExisting = current.filter((rule) => !(rule.scope === scope && rule.targetId === targetId && rule.screenId === screenId));
      return [
        ...withoutExisting,
        { id: createId('list-view-pref'), scope, targetId, screenId, visibleColumnKeys, updatedAt: new Date().toISOString(), updatedByUserId },
      ];
    });
  }, []);

  const setMyColumns = useCallback(
    (screenId: string, visibleColumnKeys: string[]) => upsertRule('user', currentUserId, screenId, visibleColumnKeys, currentUserId),
    [upsertRule, currentUserId],
  );

  const resetMyColumns = useCallback((screenId: string) => {
    setRules((current) => current.filter((rule) => !(rule.scope === 'user' && rule.targetId === currentUserId && rule.screenId === screenId)));
  }, [currentUserId]);

  const setSystemDefaultColumns = useCallback(
    (screenId: string, visibleColumnKeys: string[], updatedByUserId: string) => upsertRule('system', undefined, screenId, visibleColumnKeys, updatedByUserId),
    [upsertRule],
  );

  const value = useMemo<ListViewPreferenceContextValue>(
    () => ({ rules, getEffectiveColumns, setMyColumns, resetMyColumns, setSystemDefaultColumns }),
    [rules, getEffectiveColumns, setMyColumns, resetMyColumns, setSystemDefaultColumns],
  );

  return <ListViewPreferenceContext.Provider value={value}>{children}</ListViewPreferenceContext.Provider>;
}

export function useListViewPreferences(): ListViewPreferenceContextValue {
  const context = useContext(ListViewPreferenceContext);
  if (!context) {
    throw new Error('useListViewPreferences must be used within a ListViewPreferenceProvider');
  }
  return context;
}

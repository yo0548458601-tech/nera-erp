'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  resolveEffectivePermission,
  type EffectivePermissionResult,
  type PermissionContext,
  type PermissionDecision,
  type PermissionId,
  type PermissionRule,
} from '@nera/authorization-engine';
import { demoPermissionRules } from '../lib/authorization/demoPermissionRules';
import { demoSystemUsers, type DemoSystemUser } from '../lib/authorization/demoUsers';
import { useSession } from './SessionContext';

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type AuthorizationContextValue = {
  rules: PermissionRule[];
  systemUsers: DemoSystemUser[];
  /** Resolves the effective permission for an arbitrary user/role/institution context. */
  resolvePermission: (permission: PermissionId, context: PermissionContext) => EffectivePermissionResult;
  /** Resolves the effective permission for the currently signed-in demo user. */
  resolveMyPermission: (permission: PermissionId) => EffectivePermissionResult;
  /** Sets (or clears, via 'inherit') a user-level override for the given user + permission. */
  setUserOverride: (userId: string, permission: PermissionId, decision: PermissionDecision, updatedByUserId: string) => void;
  /** The current user-level override decision for a user + permission, or 'inherit' if none exists. */
  getUserOverride: (userId: string, permission: PermissionId) => PermissionDecision;
};

const AuthorizationContext = createContext<AuthorizationContextValue | undefined>(undefined);

/**
 * Demo authorization model: holds permission rules across the four scopes
 * (system / institution / role / user) and resolves the effective decision
 * for a permission + context using the precedence documented in
 * @nera/authorization-engine (user override -> role -> institution ->
 * system default -> deny). This is a client-side simulation only, kept in
 * memory for the demo session - nothing here is a security boundary. A
 * real Authorization Engine must enforce this server-side; hiding a
 * button based on this result is a UX convenience, not authorization.
 */
export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [rules, setRules] = useState<PermissionRule[]>(demoPermissionRules);

  const resolvePermission = useCallback(
    (permission: PermissionId, context: PermissionContext) => resolveEffectivePermission(permission, context, rules),
    [rules],
  );

  const resolveMyPermission = useCallback(
    (permission: PermissionId): EffectivePermissionResult => {
      if (!session) {
        return { permission, decision: 'deny', source: 'default' };
      }
      const systemUser = demoSystemUsers.find((user) => user.id === session.user.id);
      return resolveEffectivePermission(
        permission,
        { userId: session.user.id, roleIds: systemUser?.roleIds ?? [], institutionId: session.selectedOrganizationId },
        rules,
      );
    },
    [session, rules],
  );

  const setUserOverride = useCallback(
    (userId: string, permission: PermissionId, decision: PermissionDecision, updatedByUserId: string) => {
      setRules((current) => {
        const withoutExisting = current.filter(
          (rule) => !(rule.scope === 'user' && rule.targetId === userId && rule.permission === permission),
        );
        if (decision === 'inherit') {
          return withoutExisting;
        }
        return [
          ...withoutExisting,
          {
            id: createId('rule'),
            scope: 'user',
            targetId: userId,
            permission,
            decision,
            updatedAt: new Date().toISOString(),
            updatedByUserId,
          },
        ];
      });
    },
    [],
  );

  const getUserOverride = useCallback(
    (userId: string, permission: PermissionId): PermissionDecision => {
      const rule = rules.find((entry) => entry.scope === 'user' && entry.targetId === userId && entry.permission === permission);
      return rule?.decision ?? 'inherit';
    },
    [rules],
  );

  const value = useMemo<AuthorizationContextValue>(
    () => ({ rules, systemUsers: demoSystemUsers, resolvePermission, resolveMyPermission, setUserOverride, getUserOverride }),
    [rules, resolvePermission, resolveMyPermission, setUserOverride, getUserOverride],
  );

  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
}

export function useAuthorization(): AuthorizationContextValue {
  const context = useContext(AuthorizationContext);
  if (!context) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider');
  }
  return context;
}

/** Convenience hook: is the given permission currently allowed for the signed-in demo user? */
export function useMyPermission(permission: PermissionId): boolean {
  const { resolveMyPermission } = useAuthorization();
  return resolveMyPermission(permission).decision === 'allow';
}

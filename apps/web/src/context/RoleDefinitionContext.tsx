'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type NewRoleDefinitionInput,
  type RoleDefinition,
  type RoleDefinitionPatch,
  type RoleDefinitionStatus,
} from '@nera/entity-engine';
import { useSession } from './SessionContext';
import {
  createRoleDefinitionAction,
  listRoleDefinitionsAction,
  setRoleDefinitionStatusAction,
  updateRoleDefinitionAction,
} from '../lib/actions/roleDefinitionActions';

type RoleDefinitionContextValue = {
  /** Built-in roles plus any administrator-defined custom roles - the single live role catalog every screen reads. Real, persisted rows (P013B) - loads once per selected organization. */
  roles: RoleDefinition[];
  isLoading: boolean;
  /** Creates a new custom role. Returns an error message (Hebrew) if the key is invalid or already taken - stable keys are unique and immutable after creation. */
  addCustomRole: (
    input: NewRoleDefinitionInput
  ) => Promise<{ role?: RoleDefinition; error?: string }>;
  /** Edits an existing role's configurable metadata - never its key, and never available for isSystem roles' immutable identity fields. */
  updateRole: (id: string, patch: RoleDefinitionPatch) => Promise<void>;
  /** Hides/shows a role (built-in roles can only ever be disabled, never deleted). */
  setRoleStatus: (id: string, status: RoleDefinitionStatus) => Promise<void>;
};

const RoleDefinitionContext = createContext<RoleDefinitionContextValue | undefined>(undefined);

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Real, persisted role definitions (P013B - see docs/ROADMAP.md; Owner
 * decision 4). Every read/write goes through `roleDefinitionActions.ts`'s
 * Server Actions - no in-memory `entityRoleRegistry` seed is used as this
 * context's live state anymore (it remains the engine's built-in catalog
 * definition, transcribed into the database seed - see
 * `packages/database/src/seed.ts`).
 */
export function RoleDefinitionProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const organizationId = session?.selectedOrganizationId;
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listRoleDefinitionsAction(organizationId).then(result => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setRoles(result.data);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const addCustomRole = useCallback(
    async (input: NewRoleDefinitionInput): Promise<{ role?: RoleDefinition; error?: string }> => {
      if (!organizationId) {
        return { error: 'לא נבחר ארגון פעיל.' };
      }
      const key = input.key.trim();
      if (!KEY_PATTERN.test(key)) {
        return {
          error: 'מפתח פנימי חייב להיות באנגלית, אותיות קטנות, ספרות וקו תחתון בלבד, ולהתחיל באות.',
        };
      }
      if (roles.some(role => role.key === key)) {
        return { error: 'כבר קיים תפקיד עם מפתח פנימי זהה.' };
      }
      if (!input.label.trim()) {
        return { error: 'יש להזין שם תפקיד בעברית.' };
      }
      if (input.applicableEntityTypes.length === 0) {
        return { error: 'יש לבחור לפחות סוג ישות אחד שהתפקיד חל עליו.' };
      }

      const result = await createRoleDefinitionAction(organizationId, { ...input, key });
      if (!result.ok) {
        return { error: result.reason };
      }
      setRoles(current => [...current, result.data]);
      return { role: result.data };
    },
    [organizationId, roles]
  );

  const updateRole = useCallback(
    async (id: string, patch: RoleDefinitionPatch) => {
      if (!organizationId) {
        return;
      }
      const result = await updateRoleDefinitionAction(organizationId, id, patch);
      if (result.ok) {
        setRoles(current => current.map(role => (role.id === id ? result.data : role)));
      }
    },
    [organizationId]
  );

  const setRoleStatus = useCallback(
    async (id: string, status: RoleDefinitionStatus) => {
      if (!organizationId) {
        return;
      }
      const result = await setRoleDefinitionStatusAction(organizationId, id, status);
      if (result.ok) {
        setRoles(current => current.map(role => (role.id === id ? result.data : role)));
      }
    },
    [organizationId]
  );

  const value = useMemo<RoleDefinitionContextValue>(
    () => ({ roles, isLoading, addCustomRole, updateRole, setRoleStatus }),
    [roles, isLoading, addCustomRole, updateRole, setRoleStatus]
  );

  return <RoleDefinitionContext.Provider value={value}>{children}</RoleDefinitionContext.Provider>;
}

export function useRoleDefinitions(): RoleDefinitionContextValue {
  const context = useContext(RoleDefinitionContext);
  if (!context) {
    throw new Error('useRoleDefinitions must be used within a RoleDefinitionProvider');
  }
  return context;
}

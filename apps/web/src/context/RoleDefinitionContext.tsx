'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  entityRoleRegistry,
  type EntityType,
  type RoleDefinition,
  type RoleDefinitionStatus,
} from '@nera/entity-engine';

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type NewRoleDefinitionInput = {
  key: string;
  label: string;
  description: string;
  applicableEntityTypes: EntityType[];
  institutionId?: string;
  showInGlobalAddNew: boolean;
  allowMultipleAssignments: boolean;
  supportsDateRange: boolean;
  supportsBillingProfile: boolean;
  icon?: string;
};

export type RoleDefinitionPatch = Partial<
  Pick<
    RoleDefinition,
    | 'label'
    | 'description'
    | 'applicableEntityTypes'
    | 'institutionId'
    | 'showInGlobalAddNew'
    | 'allowMultipleAssignments'
    | 'supportsDateRange'
    | 'supportsBillingProfile'
    | 'icon'
    | 'order'
  >
>;

type RoleDefinitionContextValue = {
  /** Built-in roles plus any administrator-defined custom roles - the single live role catalog every screen reads. Demo-only: resets on reload, nothing is persisted server-side. */
  roles: RoleDefinition[];
  /** Creates a new custom role. Returns an error message (Hebrew) if the key is invalid or already taken - stable keys are unique and immutable after creation. */
  addCustomRole: (input: NewRoleDefinitionInput) => { role?: RoleDefinition; error?: string };
  /** Edits an existing role's configurable metadata - never its key, and never available for isSystem roles' immutable identity fields. */
  updateRole: (id: string, patch: RoleDefinitionPatch) => void;
  /** Hides/shows a role (built-in roles can only ever be disabled, never deleted). */
  setRoleStatus: (id: string, status: RoleDefinitionStatus) => void;
};

const RoleDefinitionContext = createContext<RoleDefinitionContextValue | undefined>(undefined);

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Holds the platform's live, administrator-configurable role catalog:
 * built-in roles (from the Entity Engine's seed, isSystem: true) plus any
 * custom roles created through the settings UI. Every screen that needs
 * "the roles a person can hold" reads from here rather than importing the
 * engine's static seed directly, so a newly created custom role is
 * immediately usable everywhere (filters, the person form, the global Add
 * New menu) without a second registration step.
 */
export function RoleDefinitionProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<RoleDefinition[]>(entityRoleRegistry);

  const addCustomRole = useCallback(
    (input: NewRoleDefinitionInput): { role?: RoleDefinition; error?: string } => {
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

      const now = new Date().toISOString();
      const role: RoleDefinition = {
        id: createId('role-def'),
        key,
        label: input.label.trim(),
        description: input.description.trim(),
        applicableEntityTypes: input.applicableEntityTypes,
        institutionId: input.institutionId,
        status: 'active',
        order: roles.length,
        icon: input.icon,
        showInGlobalAddNew: input.showInGlobalAddNew,
        allowMultipleAssignments: input.allowMultipleAssignments,
        supportsDateRange: input.supportsDateRange,
        supportsBillingProfile: input.supportsBillingProfile,
        requiredPermissions: {},
        linkedCustomFieldDefinitionIds: [],
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      };

      setRoles(current => [...current, role]);
      return { role };
    },
    [roles]
  );

  const updateRole = useCallback((id: string, patch: RoleDefinitionPatch) => {
    setRoles(current =>
      current.map(role =>
        role.id === id ? { ...role, ...patch, updatedAt: new Date().toISOString() } : role
      )
    );
  }, []);

  const setRoleStatus = useCallback((id: string, status: RoleDefinitionStatus) => {
    setRoles(current =>
      current.map(role =>
        role.id === id ? { ...role, status, updatedAt: new Date().toISOString() } : role
      )
    );
  }, []);

  const value = useMemo<RoleDefinitionContextValue>(
    () => ({ roles, addCustomRole, updateRole, setRoleStatus }),
    [roles, addCustomRole, updateRole, setRoleStatus]
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

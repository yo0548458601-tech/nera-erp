'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  mergeFieldRequirementModes,
  resolveFieldRequirement,
  type EffectiveFieldRequirement,
  type FieldRequirementMode,
  type FieldRequirementRule,
  type FieldRequirementScope,
} from '@nera/customization-engine';

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Built-in defaults per field key - NOT limited to "birthDate" (see
 * apps/web/src/config/configurableFields.ts, which is the extensible
 * catalog of fields wired into this system). A field with no entry here
 * falls back to 'optional', a reasonable platform-wide default. A field
 * that has no registered default and is never explicitly configured is
 * therefore visible-but-not-required, never silently hidden.
 */
const BUILT_IN_DEFAULTS: Record<string, FieldRequirementMode> = {
  birthDate: 'optional',
};

type FieldRequirementContextValue = {
  rules: FieldRequirementRule[];
  /** Resolves for ONE role-key context; see resolveForRoles for the multi-role merge a create/edit form needs. */
  resolveForRole: (
    fieldKey: string,
    entityType: 'person' | 'organization',
    roleKey: string | undefined,
    institutionId: string | undefined
  ) => EffectiveFieldRequirement;
  /**
   * A form may have several roles selected/assigned simultaneously - each
   * can have its own configured requirement. Merge policy (documented,
   * not silent): if ANY relevant role requires the field, the field is
   * required; else if any role/context makes it visible (optional), it is
   * shown optional; only hidden when every resolved result says hidden.
   * "Strictest visible wins" - a role that needs the field is never
   * silently overridden by one that doesn't care.
   */
  resolveForRoles: (
    fieldKey: string,
    entityType: 'person' | 'organization',
    roleKeys: string[],
    institutionId: string | undefined
  ) => FieldRequirementMode;
  setRule: (
    fieldKey: string,
    scope: FieldRequirementScope,
    targetId: string | undefined,
    mode: FieldRequirementMode,
    updatedByUserId: string
  ) => void;
};

const FieldRequirementContext = createContext<FieldRequirementContextValue | undefined>(undefined);

/**
 * Holds configurable field applicability/requirement rules (see
 * @nera/customization-engine's fieldRequirements.ts) - demo-only,
 * in-memory. This sprint only wires up "birthDate", but the model is
 * field-key generic so a future field can reuse it without a new context.
 */
export function FieldRequirementProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<FieldRequirementRule[]>([]);

  /**
   * Entity-type applicability (e.g. "birthDate" only makes sense for
   * persons) is enforced by the CALLER only ever resolving a field for the
   * entity type it actually renders - see
   * apps/web/src/config/configurableFields.ts's applicableEntityTypes,
   * which PersonFormDialog (person-only) and any future organization form
   * (which would simply never ask about "birthDate") both respect by
   * construction. This resolver stays generic and does not itself
   * hardcode any specific field's entity-type rule.
   */
  const resolveForRole = useCallback(
    (
      fieldKey: string,
      entityType: 'person' | 'organization',
      roleKey: string | undefined,
      institutionId: string | undefined
    ): EffectiveFieldRequirement =>
      resolveFieldRequirement(
        fieldKey,
        { entityType, roleKey, institutionId },
        rules,
        BUILT_IN_DEFAULTS[fieldKey] ?? 'optional'
      ),
    [rules]
  );

  const resolveForRoles = useCallback(
    (
      fieldKey: string,
      entityType: 'person' | 'organization',
      roleKeys: string[],
      institutionId: string | undefined
    ): FieldRequirementMode => {
      const keys = roleKeys.length > 0 ? roleKeys : [undefined];
      const results = keys.map(
        roleKey => resolveForRole(fieldKey, entityType, roleKey, institutionId).mode
      );
      return mergeFieldRequirementModes(results);
    },
    [resolveForRole]
  );

  const setRule = useCallback(
    (
      fieldKey: string,
      scope: FieldRequirementScope,
      targetId: string | undefined,
      mode: FieldRequirementMode,
      updatedByUserId: string
    ) => {
      setRules(current => {
        const withoutExisting = current.filter(
          rule =>
            !(rule.fieldKey === fieldKey && rule.scope === scope && rule.targetId === targetId)
        );
        return [
          ...withoutExisting,
          {
            id: createId('field-req'),
            fieldKey,
            scope,
            targetId,
            mode,
            updatedAt: new Date().toISOString(),
            updatedByUserId,
          },
        ];
      });
    },
    []
  );

  const value = useMemo<FieldRequirementContextValue>(
    () => ({ rules, resolveForRole, resolveForRoles, setRule }),
    [rules, resolveForRole, resolveForRoles, setRule]
  );

  return (
    <FieldRequirementContext.Provider value={value}>{children}</FieldRequirementContext.Provider>
  );
}

export function useFieldRequirements(): FieldRequirementContextValue {
  const context = useContext(FieldRequirementContext);
  if (!context) {
    throw new Error('useFieldRequirements must be used within a FieldRequirementProvider');
  }
  return context;
}

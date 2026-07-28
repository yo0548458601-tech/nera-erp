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
  mergeFieldRequirementModes,
  resolveFieldRequirement,
  type EffectiveFieldRequirement,
  type FieldRequirementMode,
  type FieldRequirementRule,
  type FieldRequirementScope,
} from '@nera/customization-engine';
import { useSession } from './SessionContext';
import {
  listFieldRequirementRulesAction,
  setFieldRequirementRuleAction,
} from '../lib/actions/fieldRequirementActions';

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
  isLoading: boolean;
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
  ) => Promise<void>;
};

const FieldRequirementContext = createContext<FieldRequirementContextValue | undefined>(undefined);

/**
 * Real, persisted field-state configuration rules (P013B - see
 * docs/ROADMAP.md; see @nera/customization-engine's fieldRequirements.ts).
 * Every read/write goes through `fieldRequirementActions.ts`'s Server
 * Actions - the resolver functions themselves (`resolveFieldRequirement`,
 * `mergeFieldRequirementModes`) are reused unchanged from the engine.
 */
export function FieldRequirementProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const organizationId = session?.selectedOrganizationId;
  const [rules, setRules] = useState<FieldRequirementRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listFieldRequirementRulesAction(organizationId).then(result => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setRules(result.data);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

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
    async (
      fieldKey: string,
      scope: FieldRequirementScope,
      targetId: string | undefined,
      mode: FieldRequirementMode,
      updatedByUserId: string
    ) => {
      if (!organizationId || !targetId) {
        return;
      }
      const result = await setFieldRequirementRuleAction(
        organizationId,
        fieldKey,
        scope,
        targetId,
        mode,
        updatedByUserId
      );
      if (result.ok) {
        setRules(current => [
          ...current.filter(
            rule =>
              !(rule.fieldKey === fieldKey && rule.scope === scope && rule.targetId === targetId)
          ),
          result.data,
        ]);
      }
    },
    [organizationId]
  );

  const value = useMemo<FieldRequirementContextValue>(
    () => ({ rules, isLoading, resolveForRole, resolveForRoles, setRule }),
    [rules, isLoading, resolveForRole, resolveForRoles, setRule]
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

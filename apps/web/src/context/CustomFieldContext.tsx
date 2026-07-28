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
  findCustomFieldValue,
  getCustomFieldValuesForEntity,
  type CustomFieldDefinition,
  type CustomFieldStatus,
  type CustomFieldValue,
  type CustomFieldValueData,
  type NewCustomFieldInput,
} from '@nera/customization-engine';
import { useSession } from './SessionContext';
import {
  createCustomFieldDefinitionAction,
  listCustomFieldDefinitionsAction,
  setCustomFieldDefinitionStatusAction,
  setCustomFieldValueAction,
} from '../lib/actions/customFieldActions';

type CustomFieldContextValue = {
  /** All administrator-defined custom field definitions - real, persisted rows (P013B), loaded once per selected organization. */
  definitions: CustomFieldDefinition[];
  /** Every custom field value for the selected organization (bulk-loaded, mirrors EntityContext's convention) - not paginated, matching this platform's current demo scale. */
  values: CustomFieldValue[];
  isLoading: boolean;
  addCustomField: (
    input: NewCustomFieldInput
  ) => Promise<{ definition?: CustomFieldDefinition; error?: string }>;
  setFieldStatus: (id: string, status: CustomFieldStatus) => Promise<void>;
  getValuesForEntity: (entityId: string) => CustomFieldValue[];
  getValue: (entityId: string, definitionId: string) => CustomFieldValue | undefined;
  setValue: (
    entityId: string,
    definitionId: string,
    value: CustomFieldValueData,
    updatedByUserId: string
  ) => Promise<string[]>;
};

const CustomFieldContext = createContext<CustomFieldContextValue | undefined>(undefined);

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Real, persisted custom-field definitions and values (P013B - see
 * docs/ROADMAP.md). Every read/write goes through `customFieldActions.ts`'s
 * Server Actions; `validateCustomFieldValue` still runs (inside the Server
 * Action, against the real definition) before any value is stored.
 */
export function CustomFieldProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const organizationId = session?.selectedOrganizationId;
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [values, setValues] = useState<CustomFieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listCustomFieldDefinitionsAction(organizationId).then(result => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setDefinitions(result.data.definitions);
        setValues(result.data.values);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const addCustomField = useCallback(
    async (
      input: NewCustomFieldInput
    ): Promise<{ definition?: CustomFieldDefinition; error?: string }> => {
      if (!organizationId) {
        return { error: 'לא נבחר ארגון פעיל.' };
      }
      const key = input.key.trim();
      if (!KEY_PATTERN.test(key)) {
        return {
          error: 'מפתח פנימי חייב להיות באנגלית, אותיות קטנות, ספרות וקו תחתון בלבד, ולהתחיל באות.',
        };
      }
      if (definitions.some(definition => definition.key === key)) {
        return { error: 'כבר קיים שדה מותאם אישית עם מפתח פנימי זהה.' };
      }
      if (!input.label.trim()) {
        return { error: 'יש להזין שם שדה בעברית.' };
      }
      if (
        (input.fieldType === 'single_select' || input.fieldType === 'multi_select') &&
        (!input.options || input.options.length === 0)
      ) {
        return { error: 'יש להגדיר לפחות אפשרות אחת עבור שדה מסוג רשימה.' };
      }

      const result = await createCustomFieldDefinitionAction(organizationId, { ...input, key });
      if (!result.ok) {
        return { error: result.reason };
      }
      setDefinitions(current => [...current, result.data]);
      return { definition: result.data };
    },
    [organizationId, definitions]
  );

  const setFieldStatus = useCallback(
    async (id: string, status: CustomFieldStatus) => {
      if (!organizationId) {
        return;
      }
      const result = await setCustomFieldDefinitionStatusAction(organizationId, id, status);
      if (result.ok) {
        setDefinitions(current =>
          current.map(definition => (definition.id === id ? result.data : definition))
        );
      }
    },
    [organizationId]
  );

  const getValuesForEntity = useCallback(
    (entityId: string) => getCustomFieldValuesForEntity(values, entityId),
    [values]
  );

  const getValue = useCallback(
    (entityId: string, definitionId: string) =>
      findCustomFieldValue(values, entityId, definitionId),
    [values]
  );

  const setValue = useCallback(
    async (
      entityId: string,
      definitionId: string,
      value: CustomFieldValueData,
      updatedByUserId: string
    ): Promise<string[]> => {
      if (!organizationId) {
        return ['לא נבחר ארגון פעיל.'];
      }
      const result = await setCustomFieldValueAction(
        organizationId,
        entityId,
        definitionId,
        value,
        updatedByUserId
      );
      if (!result.ok) {
        return [result.reason];
      }
      setValues(current => {
        const existing = current.find(
          entry => entry.entityId === entityId && entry.customFieldDefinitionId === definitionId
        );
        if (existing) {
          return current.map(entry => (entry.id === existing.id ? result.data : entry));
        }
        return [...current, result.data];
      });
      return [];
    },
    [organizationId]
  );

  const contextValue = useMemo<CustomFieldContextValue>(
    () => ({
      definitions,
      values,
      isLoading,
      addCustomField,
      setFieldStatus,
      getValuesForEntity,
      getValue,
      setValue,
    }),
    [
      definitions,
      values,
      isLoading,
      addCustomField,
      setFieldStatus,
      getValuesForEntity,
      getValue,
      setValue,
    ]
  );

  return <CustomFieldContext.Provider value={contextValue}>{children}</CustomFieldContext.Provider>;
}

export function useCustomFields(): CustomFieldContextValue {
  const context = useContext(CustomFieldContext);
  if (!context) {
    throw new Error('useCustomFields must be used within a CustomFieldProvider');
  }
  return context;
}

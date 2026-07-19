'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  findCustomFieldValue,
  getCustomFieldValuesForEntity,
  validateCustomFieldValue,
  type CustomFieldDefinition,
  type CustomFieldOption,
  type CustomFieldTargetScope,
  type CustomFieldType,
  type CustomFieldValidationRules,
  type CustomFieldValue,
  type CustomFieldValueData,
} from '@nera/customization-engine';

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

/**
 * One small seed field proving the custom-field platform end to end in a
 * safe, non-identity location (see moduleProfile.ts: custom fields never
 * substitute for a real identity field like name/phone/email). Additional
 * fields are created live through the settings UI.
 */
const seedCustomFieldDefinitions: CustomFieldDefinition[] = [
  {
    id: 'cf-def-known-allergies',
    key: 'known_allergies',
    label: 'רגישויות ידועות',
    description:
      'מידע רפואי כללי לידיעת הצוות בלבד - שדה לדוגמה להדגמת פלטפורמת השדות המותאמים אישית.',
    fieldType: 'short_text',
    targetScope: 'entity_type',
    targetEntityType: 'person',
    required: false,
    showInList: false,
    showInDetail: true,
    filterable: false,
    searchable: false,
    includeInExcelExport: true,
    includeInExcelImport: true,
    order: 0,
    status: 'active',
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

export type NewCustomFieldInput = {
  key: string;
  label: string;
  description?: string;
  fieldType: CustomFieldType;
  targetScope: CustomFieldTargetScope;
  targetEntityType?: 'person' | 'organization';
  targetRoleKey?: string;
  targetModuleId?: string;
  institutionId?: string;
  required: boolean;
  options?: CustomFieldOption[];
  validation?: CustomFieldValidationRules;
  showInList: boolean;
  showInDetail: boolean;
  filterable: boolean;
  searchable: boolean;
  includeInExcelExport: boolean;
  includeInExcelImport: boolean;
  viewPermission?: string;
  editPermission?: string;
  section?: string;
};

type CustomFieldContextValue = {
  /** All administrator-defined custom field definitions - demo-only, in-memory. */
  definitions: CustomFieldDefinition[];
  values: CustomFieldValue[];
  addCustomField: (input: NewCustomFieldInput) => {
    definition?: CustomFieldDefinition;
    error?: string;
  };
  setFieldStatus: (id: string, status: 'active' | 'inactive') => void;
  getValuesForEntity: (entityId: string) => CustomFieldValue[];
  getValue: (entityId: string, definitionId: string) => CustomFieldValue | undefined;
  setValue: (
    entityId: string,
    definitionId: string,
    value: CustomFieldValueData,
    updatedByUserId: string
  ) => string[];
};

const CustomFieldContext = createContext<CustomFieldContextValue | undefined>(undefined);

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Holds the platform's live custom-field definitions and their values.
 * Values are typed per field (see CustomFieldValueData), validated through
 * @nera/customization-engine before being stored, and kept as a flat
 * collection keyed by entityId + customFieldDefinitionId - matching how a
 * future `custom_field_values` database table would relate to both
 * `entities` and `custom_field_definitions` by foreign key.
 */
export function CustomFieldProvider({ children }: { children: ReactNode }) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>(
    seedCustomFieldDefinitions
  );
  const [values, setValues] = useState<CustomFieldValue[]>([]);

  const addCustomField = useCallback(
    (input: NewCustomFieldInput): { definition?: CustomFieldDefinition; error?: string } => {
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

      const now = new Date().toISOString();
      const definition: CustomFieldDefinition = {
        id: createId('cf-def'),
        key,
        label: input.label.trim(),
        description: input.description?.trim() || undefined,
        fieldType: input.fieldType,
        targetScope: input.targetScope,
        targetEntityType: input.targetEntityType,
        targetRoleKey: input.targetRoleKey,
        targetModuleId: input.targetModuleId,
        institutionId: input.institutionId,
        required: input.required,
        options: input.options,
        validation: input.validation,
        showInList: input.showInList,
        showInDetail: input.showInDetail,
        filterable: input.filterable,
        searchable: input.searchable,
        includeInExcelExport: input.includeInExcelExport,
        includeInExcelImport: input.includeInExcelImport,
        viewPermission: input.viewPermission,
        editPermission: input.editPermission,
        order: definitions.length,
        section: input.section,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      setDefinitions(current => [...current, definition]);
      return { definition };
    },
    [definitions]
  );

  const setFieldStatus = useCallback((id: string, status: 'active' | 'inactive') => {
    setDefinitions(current =>
      current.map(definition =>
        definition.id === id
          ? { ...definition, status, updatedAt: new Date().toISOString() }
          : definition
      )
    );
  }, []);

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
    (
      entityId: string,
      definitionId: string,
      value: CustomFieldValueData,
      updatedByUserId: string
    ): string[] => {
      const definition = definitions.find(entry => entry.id === definitionId);
      if (!definition) {
        return ['שדה מותאם אישית לא נמצא.'];
      }
      const errors = validateCustomFieldValue(definition, value);
      if (errors.length > 0) {
        return errors;
      }

      setValues(current => {
        const existing = current.find(
          entry => entry.entityId === entityId && entry.customFieldDefinitionId === definitionId
        );
        const now = new Date().toISOString();
        if (existing) {
          return current.map(entry =>
            entry.id === existing.id ? { ...entry, value, updatedAt: now, updatedByUserId } : entry
          );
        }
        return [
          ...current,
          {
            id: createId('cf-val'),
            customFieldDefinitionId: definitionId,
            entityId,
            value,
            createdAt: now,
            updatedAt: now,
            updatedByUserId,
          },
        ];
      });
      return [];
    },
    [definitions]
  );

  const contextValue = useMemo<CustomFieldContextValue>(
    () => ({
      definitions,
      values,
      addCustomField,
      setFieldStatus,
      getValuesForEntity,
      getValue,
      setValue,
    }),
    [definitions, values, addCustomField, setFieldStatus, getValuesForEntity, getValue, setValue]
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

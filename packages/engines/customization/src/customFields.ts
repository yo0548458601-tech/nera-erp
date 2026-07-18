/**
 * The Customization Engine (see docs/ARCHITECTURE.md section 15 - already
 * an approved Core Engine) owns configurable fields/forms/lists platform
 * wide. This module is its first concrete capability: administrator
 * defined custom fields, applicable to an entity type, a role definition,
 * a module, or an institution - without any module hardcoding its own
 * ad-hoc "extra fields" mechanism.
 */

export type CustomFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'file'
  | 'document';

/** What a custom field definition is scoped to. A definition may narrow via targetEntityType/targetRoleKey/targetModuleId in addition to institutionId. */
export type CustomFieldTargetScope = 'entity_type' | 'role' | 'module' | 'institution';

export type CustomFieldOption = {
  id: string;
  /** Hebrew label shown in the UI. */
  label: string;
  /** Stable value stored on records - English, immutable. */
  value: string;
};

export type CustomFieldValidationRules = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Regex source (no flags) for short_text validation. */
  pattern?: string;
};

export type CustomFieldStatus = 'active' | 'inactive';

/**
 * A single administrator-defined field. `key` is the stable, English,
 * immutable-after-creation identifier values are stored against
 * (CustomFieldValue.customFieldDefinitionId actually references `id`, but
 * `key` is what a future Excel import/export column mapping is driven by,
 * matching the platform's "stable internal key" convention used for role
 * definitions too).
 */
export type CustomFieldDefinition = {
  id: string;
  key: string;
  /** Hebrew label shown in the UI. */
  label: string;
  description?: string;
  helpText?: string;
  fieldType: CustomFieldType;
  targetScope: CustomFieldTargetScope;
  /** Set when targetScope is 'entity_type'. */
  targetEntityType?: 'person' | 'organization';
  /** Set when targetScope is 'role' - a RoleDefinition.key. */
  targetRoleKey?: string;
  /** Set when targetScope is 'module' - a module identifier (e.g. "contacts"). */
  targetModuleId?: string;
  /** Narrows any of the scopes above to one institution; undefined = applies platform/tenant-wide. */
  institutionId?: string;
  required: boolean;
  defaultValue?: CustomFieldValueData;
  validation?: CustomFieldValidationRules;
  /** Only meaningful for single_select/multi_select. */
  options?: CustomFieldOption[];
  showInList: boolean;
  showInDetail: boolean;
  filterable: boolean;
  searchable: boolean;
  includeInExcelExport: boolean;
  includeInExcelImport: boolean;
  viewPermission?: string;
  editPermission?: string;
  order: number;
  section?: string;
  status: CustomFieldStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

/** Typed value payload per field type - never a bare unvalidated string regardless of fieldType. */
export type CustomFieldValueData =
  | { type: 'short_text'; value: string }
  | { type: 'long_text'; value: string }
  | { type: 'number'; value: number }
  | { type: 'currency'; value: number; currency?: string }
  | { type: 'date'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'single_select'; value: string }
  | { type: 'multi_select'; value: string[] }
  | { type: 'file'; value: { fileName: string; note?: string } }
  | { type: 'document'; value: { fileName: string; note?: string } };

function isVisible(definition: CustomFieldDefinition): boolean {
  return definition.status === 'active' && !definition.deletedAt;
}

/** Fields relevant to a given entity type (via targetScope 'entity_type' or a role targeting that type through targetRoleKey resolution happens at the app layer, which has the role registry). */
export function getFieldsForEntityType(definitions: CustomFieldDefinition[], entityType: 'person' | 'organization'): CustomFieldDefinition[] {
  return definitions
    .filter((definition) => isVisible(definition) && definition.targetScope === 'entity_type' && definition.targetEntityType === entityType)
    .sort((a, b) => a.order - b.order);
}

export function getFieldsForRole(definitions: CustomFieldDefinition[], roleKey: string): CustomFieldDefinition[] {
  return definitions
    .filter((definition) => isVisible(definition) && definition.targetScope === 'role' && definition.targetRoleKey === roleKey)
    .sort((a, b) => a.order - b.order);
}

export function findCustomFieldDefinition(definitions: CustomFieldDefinition[], key: string): CustomFieldDefinition | undefined {
  return definitions.find((definition) => definition.key === key);
}

function isEmptyValue(value: CustomFieldValueData | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  if (value.type === 'short_text' || value.type === 'long_text' || value.type === 'single_select') {
    return value.value.trim() === '';
  }
  if (value.type === 'multi_select') {
    return value.value.length === 0;
  }
  return false;
}

/**
 * Validates a value against its field definition: required-ness, type
 * match, and any configured min/max/length/pattern rule. Returns Hebrew
 * validation error messages (empty array = valid). This is a demo-level
 * validation helper - a future server must re-validate independently.
 */
export function validateCustomFieldValue(definition: CustomFieldDefinition, value: CustomFieldValueData | undefined): string[] {
  const errors: string[] = [];

  if (definition.required && isEmptyValue(value)) {
    errors.push(`השדה "${definition.label}" הוא שדה חובה.`);
    return errors;
  }

  if (value === undefined) {
    return errors;
  }

  if (value.type !== definition.fieldType) {
    errors.push(`סוג הערך שהוזן אינו תואם להגדרת השדה "${definition.label}".`);
    return errors;
  }

  const rules = definition.validation;
  if (!rules) {
    return errors;
  }

  if ((value.type === 'short_text' || value.type === 'long_text') && typeof value.value === 'string') {
    if (rules.minLength !== undefined && value.value.length < rules.minLength) {
      errors.push(`השדה "${definition.label}" קצר מדי (מינימום ${rules.minLength} תווים).`);
    }
    if (rules.maxLength !== undefined && value.value.length > rules.maxLength) {
      errors.push(`השדה "${definition.label}" ארוך מדי (מקסימום ${rules.maxLength} תווים).`);
    }
    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value.value)) {
        errors.push(`השדה "${definition.label}" אינו תואם לתבנית הנדרשת.`);
      }
    }
  }

  if ((value.type === 'number' || value.type === 'currency') && typeof value.value === 'number') {
    if (rules.min !== undefined && value.value < rules.min) {
      errors.push(`השדה "${definition.label}" קטן מהערך המינימלי המותר (${rules.min}).`);
    }
    if (rules.max !== undefined && value.value > rules.max) {
      errors.push(`השדה "${definition.label}" גדול מהערך המקסימלי המותר (${rules.max}).`);
    }
  }

  return errors;
}

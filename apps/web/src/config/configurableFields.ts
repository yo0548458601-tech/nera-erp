'use client';

import { type EntityType } from '@nera/entity-engine';
import { useCustomFields } from '../context/CustomFieldContext';

export type ConfigurableFieldSource = 'built_in' | 'custom_field';

/**
 * The catalog of fields eligible for the generic field-state system (see
 * @nera/customization-engine's fieldRequirements.ts): hidden / optional /
 * required / read-only, configurable by role/institution/entity type. This
 * is deliberately a plain, extensible list rather than a single hardcoded
 * field - adding a new built-in field to this array (or defining a custom
 * field, which is picked up automatically below) is the entire integration
 * work needed for that field to gain configurable requirement/visibility
 * support; no new engine or context code is needed.
 */
export type ConfigurableFieldDefinition = {
  key: string;
  label: string;
  source: ConfigurableFieldSource;
  applicableEntityTypes: EntityType[];
};

/** Built-in fields wired into the generic field-state system this sprint. Only "תאריך לידה" has UI wired up in PersonFormDialog (see FieldRequirementContext) - the list itself is intentionally not limited to one entry. */
export const BUILT_IN_CONFIGURABLE_FIELDS: ConfigurableFieldDefinition[] = [
  { key: 'birthDate', label: 'תאריך לידה', source: 'built_in', applicableEntityTypes: ['person'] },
];

/** Built-in configurable fields plus one entry per active custom field - the same combined-catalog pattern already used by contactsListColumns.ts. */
export function useConfigurableFields(): ConfigurableFieldDefinition[] {
  const { definitions } = useCustomFields();
  const customFieldEntries: ConfigurableFieldDefinition[] = definitions
    .filter(definition => definition.status === 'active')
    .map(definition => ({
      key: definition.key,
      label: definition.label,
      source: 'custom_field',
      applicableEntityTypes: definition.targetEntityType
        ? [definition.targetEntityType]
        : ['person', 'organization'],
    }));

  return [...BUILT_IN_CONFIGURABLE_FIELDS, ...customFieldEntries];
}

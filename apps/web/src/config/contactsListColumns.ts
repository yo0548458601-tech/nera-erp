'use client';

import { getFieldsForEntityType, type ListColumnDefinition } from '@nera/customization-engine';
import { useCustomFields } from '../context/CustomFieldContext';

export const CONTACTS_SCREEN_ID = 'contacts';

/** The Contacts list's built-in columns - "name" is required and can never be hidden, matching the platform rule that a list must always keep at least its primary identity column visible. */
export const BUILT_IN_CONTACTS_COLUMNS: ListColumnDefinition[] = [
  {
    key: 'name',
    hebrewHeader: 'שם',
    source: 'built_in',
    defaultVisible: true,
    defaultOrder: 0,
    required: true,
  },
  {
    key: 'roles',
    hebrewHeader: 'תפקידים',
    source: 'built_in',
    defaultVisible: true,
    defaultOrder: 1,
  },
  /**
   * Gregorian and Hebrew birth date are two independent first-class
   * columns (P007.5) - never one combined column with a display-mode
   * toggle. Each is separately visible/hidden/ordered through the column
   * chooser, separately filterable (see the Hebrew month/day filters),
   * and separately exported to XLSX (see personColumns.ts).
   */
  {
    key: 'birthDateGregorian',
    hebrewHeader: 'תאריך לידה לועזי',
    source: 'built_in',
    defaultVisible: true,
    defaultOrder: 2,
  },
  {
    key: 'birthDateHebrew',
    hebrewHeader: 'תאריך לידה עברי',
    source: 'built_in',
    defaultVisible: false,
    defaultOrder: 3,
  },
  {
    key: 'phone',
    hebrewHeader: 'טלפון',
    source: 'built_in',
    defaultVisible: true,
    defaultOrder: 4,
  },
  {
    key: 'email',
    hebrewHeader: 'דוא"ל',
    source: 'built_in',
    defaultVisible: true,
    defaultOrder: 5,
  },
  {
    key: 'address',
    hebrewHeader: 'כתובת',
    source: 'built_in',
    defaultVisible: false,
    defaultOrder: 6,
  },
  { key: 'tags', hebrewHeader: 'תגיות', source: 'built_in', defaultVisible: true, defaultOrder: 7 },
  {
    key: 'status',
    hebrewHeader: 'סטטוס',
    source: 'built_in',
    defaultVisible: true,
    defaultOrder: 8,
  },
];

/** Built-in columns plus one column per active custom field marked showInList=true - the same catalog the column chooser, the administrator defaults settings panel, and (via personColumns.ts) the XLSX export all read from. */
export function useContactsListColumnDefinitions(): ListColumnDefinition[] {
  const { definitions } = useCustomFields();
  const customColumns: ListColumnDefinition[] = getFieldsForEntityType(definitions, 'person')
    .filter(definition => definition.showInList)
    .map((definition, index) => ({
      key: definition.key,
      hebrewHeader: definition.label,
      source: 'custom_field',
      defaultVisible: true,
      defaultOrder: 100 + index,
    }));

  return [...BUILT_IN_CONTACTS_COLUMNS, ...customColumns];
}

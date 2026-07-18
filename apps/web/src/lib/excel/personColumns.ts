import { type CustomFieldDefinition, type CustomFieldValue, type ExcelColumnContract } from '@nera/customization-engine';
import {
  formatAddress,
  getEntityIdentifierNumber,
  getNeraIdSequenceNumber,
  getPrimaryAddress,
  getPrimaryEmail,
  getPrimaryPhone,
  type PersonEntity,
} from '@nera/entity-engine';
import { computeHebrewBirthDate, formatGregorianBirthDate } from '../dates/hebrewBirthDate';
import { formatCustomFieldValue } from '../../components/customFields/CustomFieldInput';

const ADJUSTMENT_LABELS: Record<-1 | 0 | 1, string> = {
  '-1': 'יום אחד אחורה',
  '0': 'ללא תיקון',
  '1': 'יום אחד קדימה',
};

/**
 * The person Excel column set: built-in identity/contact/address columns
 * plus the required Hebrew-date columns (Gregorian, Hebrew, and the
 * applied adjustment), plus one ExcelColumnContract per active custom
 * field marked includeInExcelExport - all produced through the shared
 * @nera/customization-engine contract, so this is the one and only Excel
 * column builder for the Contacts list (no parallel export mechanism).
 * Consumed by buildXlsxWorkbookBuffer (see xlsxWriter.ts): `cellType`/
 * `numberFormat` drive real typed Excel cells (a numeric Nera ID, a real
 * date cell for the Gregorian birth date); `format` remains a plain-text
 * fallback used by any non-typed-cell consumer of the same contract.
 * Only the entity's PRIMARY address is included here, per the platform
 * rule that default export columns use the primary address - see
 * xlsxWriter.ts / the sprint report for the "all addresses" export mode.
 */
export function buildPersonExcelColumns(customFieldDefinitions: CustomFieldDefinition[], customFieldValues: CustomFieldValue[]): ExcelColumnContract<PersonEntity>[] {
  const builtIn: ExcelColumnContract<PersonEntity>[] = [
    {
      columnKey: 'first_name',
      hebrewHeader: 'שם פרטי',
      resolveValue: (person) => person.profile.firstName,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'last_name',
      hebrewHeader: 'שם משפחה',
      resolveValue: (person) => person.profile.lastName,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'nera_id',
      hebrewHeader: 'מזהה Nera',
      /**
       * Exports only the numeric sequence (e.g. 108, not "NERA-00000108")
       * so Excel sorts/filters it numerically - see getNeraIdSequenceNumber's
       * docstring. The full permanent id is never changed; this is purely
       * an export-time resolver.
       */
      resolveValue: (person) => getNeraIdSequenceNumber(person.neraId),
      format: (value) => String(value ?? ''),
      cellType: 'number',
      numberFormat: '0',
      exportEnabled: true,
      importEnabled: false,
    },
    {
      columnKey: 'id_number',
      hebrewHeader: 'מספר זהות',
      resolveValue: (person) => getEntityIdentifierNumber(person),
      format: (value) => String(value ?? ''),
      requiredPermission: 'entities.view_sensitive',
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'primary_phone',
      hebrewHeader: 'טלפון ראשי',
      resolveValue: (person) => getPrimaryPhone(person.profile)?.number,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'primary_email',
      hebrewHeader: 'דוא"ל ראשי',
      resolveValue: (person) => getPrimaryEmail(person.profile)?.address,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'birth_date_gregorian',
      hebrewHeader: 'תאריך לידה לועזי',
      /** Raw YYYY-MM-DD, consumed as a real Excel date cell (DD/MM/YYYY number format) by the typed-cell writer; format() below is the plain-text fallback. */
      resolveValue: (person) => person.profile.birthDateGregorian,
      format: (value) => (value ? formatGregorianBirthDate(String(value)).display : ''),
      cellType: 'date',
      numberFormat: 'DD/MM/YYYY',
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'birth_date_hebrew',
      hebrewHeader: 'תאריך לידה עברי',
      resolveValue: (person) => person,
      format: (value) => {
        const person = value as PersonEntity;
        return person.profile.birthDateGregorian
          ? computeHebrewBirthDate(person.profile.birthDateGregorian, person.profile.hebrewDateAdjustmentDays).display
          : '';
      },
      exportEnabled: true,
      importEnabled: false,
    },
    {
      columnKey: 'hebrew_date_adjustment',
      hebrewHeader: 'תיקון תאריך עברי',
      resolveValue: (person) => person.profile.hebrewDateAdjustmentDays,
      format: (value) => ADJUSTMENT_LABELS[value as -1 | 0 | 1] ?? 'ללא תיקון',
      exportEnabled: true,
      importEnabled: false,
    },
    {
      columnKey: 'address_country',
      hebrewHeader: 'מדינה',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.country,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'address_city',
      hebrewHeader: 'עיר',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.city,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'address_street',
      hebrewHeader: 'רחוב',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.street,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'address_house_number',
      hebrewHeader: 'מספר בית',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.houseNumber,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'address_entrance',
      hebrewHeader: 'כניסה',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.entrance,
      format: (value) => String(value ?? ''),
      exportEnabled: false,
      importEnabled: true,
    },
    {
      columnKey: 'address_floor',
      hebrewHeader: 'קומה',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.floor,
      format: (value) => String(value ?? ''),
      exportEnabled: false,
      importEnabled: true,
    },
    {
      columnKey: 'address_apartment',
      hebrewHeader: 'דירה',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.apartment,
      format: (value) => String(value ?? ''),
      exportEnabled: false,
      importEnabled: true,
    },
    {
      columnKey: 'address_postal_code',
      hebrewHeader: 'מיקוד',
      resolveValue: (person) => getPrimaryAddress(person.profile)?.postalCode,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: true,
    },
    {
      columnKey: 'address_full',
      hebrewHeader: 'כתובת מלאה',
      resolveValue: (person) => {
        const primary = getPrimaryAddress(person.profile);
        return primary ? formatAddress(primary) : '';
      },
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: false,
    },
    {
      columnKey: 'tags',
      hebrewHeader: 'תגיות',
      resolveValue: (person) => person.tags,
      format: (value) => (Array.isArray(value) ? value.join(', ') : ''),
      exportEnabled: true,
      importEnabled: false,
    },
    {
      columnKey: 'status',
      hebrewHeader: 'סטטוס',
      resolveValue: (person) => person.status,
      format: (value) => String(value ?? ''),
      exportEnabled: true,
      importEnabled: false,
    },
  ];

  const customFieldColumns: ExcelColumnContract<PersonEntity>[] = customFieldDefinitions
    .filter((definition) => definition.includeInExcelExport)
    .map((definition) => ({
      columnKey: definition.key,
      hebrewHeader: definition.label,
      resolveValue: (person: PersonEntity) => customFieldValues.find((value) => value.entityId === person.id && value.customFieldDefinitionId === definition.id)?.value,
      format: (value) => formatCustomFieldValue(value as never),
      requiredPermission: definition.viewPermission,
      exportEnabled: definition.includeInExcelExport,
      importEnabled: definition.includeInExcelImport,
    }));

  return [...builtIn, ...customFieldColumns];
}

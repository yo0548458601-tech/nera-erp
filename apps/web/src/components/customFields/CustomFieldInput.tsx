'use client';

import { type CustomFieldDefinition, type CustomFieldValueData } from '@nera/customization-engine';

type CustomFieldInputProps = {
  definition: CustomFieldDefinition;
  value: CustomFieldValueData | undefined;
  onChange: (value: CustomFieldValueData) => void;
};

const inputClassName =
  'rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-400';

/**
 * Renders one editable control for one custom field, typed per fieldType.
 * This is the shared rendering foundation every future custom-field host
 * (person detail, a future module) reuses instead of building its own
 * ad-hoc field UI per field type.
 */
export function CustomFieldInput({ definition, value, onChange }: CustomFieldInputProps) {
  switch (definition.fieldType) {
    case 'short_text':
      return (
        <input
          value={value?.type === 'short_text' ? value.value : ''}
          onChange={event => onChange({ type: 'short_text', value: event.target.value })}
          className={inputClassName}
        />
      );
    case 'long_text':
      return (
        <textarea
          value={value?.type === 'long_text' ? value.value : ''}
          onChange={event => onChange({ type: 'long_text', value: event.target.value })}
          rows={3}
          className={inputClassName}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value?.type === 'number' ? value.value : ''}
          onChange={event => onChange({ type: 'number', value: Number(event.target.value) })}
          className={inputClassName}
        />
      );
    case 'currency':
      return (
        <input
          type="number"
          value={value?.type === 'currency' ? value.value : ''}
          onChange={event =>
            onChange({ type: 'currency', value: Number(event.target.value), currency: 'ILS' })
          }
          className={inputClassName}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={value?.type === 'date' ? value.value : ''}
          onChange={event => onChange({ type: 'date', value: event.target.value })}
          className={inputClassName}
        />
      );
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value?.type === 'boolean' ? value.value : false}
            onChange={event => onChange({ type: 'boolean', value: event.target.checked })}
          />
          כן
        </label>
      );
    case 'single_select':
      return (
        <select
          value={value?.type === 'single_select' ? value.value : ''}
          onChange={event => onChange({ type: 'single_select', value: event.target.value })}
          className={inputClassName}
        >
          <option value="">בחר</option>
          {(definition.options ?? []).map(option => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case 'multi_select': {
      const selected = value?.type === 'multi_select' ? value.value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {(definition.options ?? []).map(option => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  onChange({
                    type: 'multi_select',
                    value: isSelected
                      ? selected.filter(entry => entry !== option.value)
                      : [...selected, option.value],
                  })
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }
    case 'file':
    case 'document':
      return (
        <input
          placeholder="שם קובץ (הדגמה - ללא העלאה בפועל)"
          value={value?.type === definition.fieldType ? value.value.fileName : ''}
          onChange={event =>
            onChange({
              type: definition.fieldType,
              value: { fileName: event.target.value },
            } as CustomFieldValueData)
          }
          className={inputClassName}
        />
      );
    default:
      return null;
  }
}

/** A read-only rendering of a custom field's current value, for compact display contexts. */
export function formatCustomFieldValue(value: CustomFieldValueData | undefined): string {
  if (!value) {
    return '—';
  }
  switch (value.type) {
    case 'short_text':
    case 'long_text':
    case 'single_select':
      return value.value || '—';
    case 'number':
      return String(value.value);
    case 'currency':
      return `${value.value} ${value.currency ?? 'ILS'}`;
    case 'date':
      return value.value;
    case 'boolean':
      return value.value ? 'כן' : 'לא';
    case 'multi_select':
      return value.value.length > 0 ? value.value.join(', ') : '—';
    case 'file':
    case 'document':
      return value.value.fileName || '—';
    default:
      return '—';
  }
}

'use client';

import { useState, type FormEvent } from 'react';
import { type CustomFieldTargetScope, type CustomFieldType } from '@nera/customization-engine';
import { useCustomFields } from '../../context/CustomFieldContext';
import { useMyPermission } from '../../context/AuthorizationContext';
import { PanelCard } from '../PanelCard';

const fieldTypeLabels: Record<CustomFieldType, string> = {
  short_text: 'טקסט קצר',
  long_text: 'טקסט ארוך',
  number: 'מספר',
  currency: 'סכום כספי',
  date: 'תאריך',
  boolean: 'כן/לא',
  single_select: 'רשימה - בחירה יחידה',
  multi_select: 'רשימה - בחירה מרובה',
  file: 'קובץ',
  document: 'מסמך',
};

/**
 * 'institution' is deliberately excluded here (Owner decision 3, P013B):
 * CustomFieldTargetScope still carries an 'institution' value on the pure
 * engine type, but no institution-scoped target exists in this sprint, so
 * this settings UI never offers it as a selectable scope.
 */
const scopeLabels: Record<Exclude<CustomFieldTargetScope, 'institution'>, string> = {
  entity_type: 'סוג ישות',
  role: 'תפקיד',
  module: 'מודול',
};

/**
 * Settings for administrator-configurable custom fields: view existing
 * definitions and create new ones with a target scope, field type, and the
 * visibility/filter/search/Excel flags every field carries. Real,
 * persisted rows (P013B - see docs/ROADMAP.md). File uploads are never
 * claimed to persist - the "file"/"document" types only record a file name,
 * matching the platform rule that a capability must not pretend to do more
 * than it does.
 */
export function CustomFieldsPanel() {
  const canManage = useMyPermission('custom_fields.manage');
  const { definitions, isLoading, addCustomField, setFieldStatus } = useCustomFields();

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('short_text');
  const [targetScope, setTargetScope] =
    useState<Exclude<CustomFieldTargetScope, 'institution'>>('entity_type');
  const [targetEntityType, setTargetEntityType] = useState<'person' | 'organization'>('person');
  const [required, setRequired] = useState(false);
  const [showInList, setShowInList] = useState(false);
  const [showInDetail, setShowInDetail] = useState(true);
  const [filterable, setFilterable] = useState(false);
  const [searchable, setSearchable] = useState(false);
  const [includeInExcelExport, setIncludeInExcelExport] = useState(true);
  const [includeInExcelImport, setIncludeInExcelImport] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!canManage) {
    return (
      <PanelCard title="שדות מותאמים אישית">
        <p className="text-sm text-slate-500">אין לך הרשאה לנהל שדות מותאמים אישית.</p>
      </PanelCard>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const result = await addCustomField({
      key: key.trim(),
      label,
      fieldType,
      targetScope,
      targetEntityType: targetScope === 'entity_type' ? targetEntityType : undefined,
      required,
      options:
        fieldType === 'single_select' || fieldType === 'multi_select'
          ? [{ id: 'opt-1', label: 'אפשרות 1', value: 'option_1' }]
          : undefined,
      showInList,
      showInDetail,
      filterable,
      searchable,
      includeInExcelExport,
      includeInExcelImport,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccessMessage(`השדה "${result.definition?.label}" נוצר בהצלחה.`);
    setKey('');
    setLabel('');
    setFieldType('short_text');
    setTargetScope('entity_type');
    setTargetEntityType('person');
    setRequired(false);
    setShowInList(false);
    setShowInDetail(true);
    setFilterable(false);
    setSearchable(false);
    setIncludeInExcelExport(true);
    setIncludeInExcelImport(false);
  };

  return (
    <PanelCard
      title="שדות מותאמים אישית"
      subtitle="ערכי קבצים/מסמכים אינם נשמרים בפועל בשלב זה - רק שם הקובץ נרשם."
    >
      <div className="flex flex-col gap-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-3 py-2">
                  שדה
                </th>
                <th scope="col" className="px-3 py-2">
                  מפתח פנימי
                </th>
                <th scope="col" className="px-3 py-2">
                  סוג
                </th>
                <th scope="col" className="px-3 py-2">
                  תחולה
                </th>
                <th scope="col" className="px-3 py-2">
                  חובה
                </th>
                <th scope="col" className="px-3 py-2">
                  ייצוא לאקסל
                </th>
                <th scope="col" className="px-3 py-2">
                  סטטוס
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                    טוען...
                  </td>
                </tr>
              ) : (
                definitions.map(definition => (
                  <tr key={definition.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{definition.label}</p>
                      {definition.description ? (
                        <p className="text-xs text-slate-400">{definition.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{definition.key}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {fieldTypeLabels[definition.fieldType]}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {definition.targetScope === 'institution'
                        ? 'מוסד'
                        : scopeLabels[definition.targetScope]}
                      {definition.targetEntityType
                        ? ` (${definition.targetEntityType === 'person' ? 'אדם' : 'ארגון'})`
                        : ''}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {definition.required ? 'כן' : 'לא'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {definition.includeInExcelExport ? 'כן' : 'לא'}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setFieldStatus(
                            definition.id,
                            definition.status === 'active' ? 'inactive' : 'active'
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          definition.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        {definition.status === 'active' ? 'פעיל' : 'מושבת'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 border-t border-slate-100 pt-4"
        >
          <p className="text-sm font-semibold text-slate-700">הוספת שדה מותאם אישית</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">מפתח פנימי (אנגלית) *</span>
              <input
                required
                value={key}
                onChange={event => setKey(event.target.value)}
                placeholder="לדוגמה: shirt_size"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">שם השדה בעברית *</span>
              <input
                required
                value={label}
                onChange={event => setLabel(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">סוג שדה</span>
              <select
                value={fieldType}
                onChange={event => setFieldType(event.target.value as CustomFieldType)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                {Object.entries(fieldTypeLabels).map(([value, fieldLabel]) => (
                  <option key={value} value={value}>
                    {fieldLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">תחולה (Scope)</span>
              <select
                value={targetScope}
                onChange={event =>
                  setTargetScope(
                    event.target.value as Exclude<CustomFieldTargetScope, 'institution'>
                  )
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                {Object.entries(scopeLabels).map(([value, scopeLabel]) => (
                  <option key={value} value={value}>
                    {scopeLabel}
                  </option>
                ))}
              </select>
            </label>
            {targetScope === 'entity_type' ? (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-700">סוג ישות</span>
                <select
                  value={targetEntityType}
                  onChange={event =>
                    setTargetEntityType(event.target.value as 'person' | 'organization')
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <option value="person">אדם</option>
                  <option value="organization">ארגון/חברה</option>
                </select>
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={required}
                onChange={event => setRequired(event.target.checked)}
              />
              שדה חובה
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInList}
                onChange={event => setShowInList(event.target.checked)}
              />
              הצג ברשימה
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInDetail}
                onChange={event => setShowInDetail(event.target.checked)}
              />
              הצג בכרטיס פרטים
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterable}
                onChange={event => setFilterable(event.target.checked)}
              />
              ניתן לסינון
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={searchable}
                onChange={event => setSearchable(event.target.checked)}
              />
              ניתן לחיפוש
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeInExcelExport}
                onChange={event => setIncludeInExcelExport(event.target.checked)}
              />
              כלול בייצוא לאקסל
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeInExcelImport}
                onChange={event => setIncludeInExcelImport(event.target.checked)}
              />
              כלול בייבוא מאקסל
            </label>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="self-start rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            הוסף שדה
          </button>
        </form>
      </div>
    </PanelCard>
  );
}

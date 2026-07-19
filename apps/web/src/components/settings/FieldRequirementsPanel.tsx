'use client';

import { useState } from 'react';
import { getRolesForEntityType } from '@nera/entity-engine';
import { type FieldRequirementMode, type FieldRequirementScope } from '@nera/customization-engine';
import { useMyPermission } from '../../context/AuthorizationContext';
import { useFieldRequirements } from '../../context/FieldRequirementContext';
import { useRoleDefinitions } from '../../context/RoleDefinitionContext';
import { useSession } from '../../context/SessionContext';
import { useConfigurableFields } from '../../config/configurableFields';
import { demoOrganizations } from '../../lib/auth/demoData';
import { PanelCard } from '../PanelCard';

const modeLabels: Record<FieldRequirementMode, string> = {
  hidden: 'מוסתר',
  optional: 'מוצג - אופציונלי',
  required: 'מוצג - חובה',
  read_only: 'מוצג - לקריאה בלבד',
};
const scopeLabels: Record<FieldRequirementScope, string> = {
  role: 'תפקיד',
  institution: 'מוסד',
  entity_type: 'סוג ישות',
  module: 'מודול',
};

/**
 * Settings foundation for the GENERIC field-state system (see
 * @nera/customization-engine's fieldRequirements.ts): any built-in field
 * registered in configurableFields.ts, or any active custom field, can be
 * configured here - not just birth date. An administrator picks a field
 * (from the combined built-in + custom-field catalog), a scope (role/
 * institution/entity type) and a target, then a mode (hidden/optional/
 * required/read-only). Full per-field UI beyond this generic form is not
 * built this sprint - the architecture is what's being delivered.
 */
export function FieldRequirementsPanel() {
  const canManage = useMyPermission('field_requirements.manage_defaults');
  const { session } = useSession();
  const { rules, setRule } = useFieldRequirements();
  const { roles } = useRoleDefinitions();
  const personRoles = getRolesForEntityType(roles, 'person');
  const configurableFields = useConfigurableFields();

  const [fieldKey, setFieldKey] = useState(configurableFields[0]?.key ?? 'birthDate');
  const [scope, setScope] = useState<FieldRequirementScope>('role');
  const [targetId, setTargetId] = useState('');
  const [mode, setMode] = useState<FieldRequirementMode>('optional');
  const [successMessage, setSuccessMessage] = useState('');

  if (!canManage) {
    return (
      <PanelCard title="שדות חובה/אופציונליים">
        <p className="text-sm text-slate-500">אין לך הרשאה לנהל הגדרות שדה חובה.</p>
      </PanelCard>
    );
  }

  const targetOptions: Array<{ id: string; label: string }> =
    scope === 'role'
      ? personRoles.map(role => ({ id: role.key, label: role.label }))
      : scope === 'institution'
        ? demoOrganizations.map(org => ({ id: org.id, label: org.name }))
        : scope === 'entity_type'
          ? ([{ id: 'person', label: 'אדם' }] satisfies Array<{ id: string; label: string }>)
          : [];

  const handleSubmit = () => {
    if (!targetId) {
      return;
    }
    setRule(fieldKey, scope, targetId, mode, session?.user.id ?? 'demo-user');
    setSuccessMessage('ההגדרה נשמרה.');
    window.setTimeout(() => setSuccessMessage(''), 2000);
  };

  return (
    <PanelCard
      title="מצב שדות (חובה / אופציונלי / מוסתר / לקריאה בלבד)"
      subtitle="מצב הדגמה - מערכת גנרית לכל שדה מובנה או שדה מותאם אישית פעיל, לפי תפקיד, מוסד או סוג ישות."
    >
      <div className="flex flex-col gap-4">
        {rules.length === 0 ? (
          <p className="text-sm text-slate-400">
            לא הוגדרו כללים מותאמים אישית - חלה ברירת המחדל המובנית של כל שדה.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map(rule => (
              <li
                key={rule.id}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                {configurableFields.find(field => field.key === rule.fieldKey)?.label ??
                  rule.fieldKey}{' '}
                · {scopeLabels[rule.scope]}: {rule.targetId} →{' '}
                <span className="font-medium">{modeLabels[rule.mode]}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">שדה</span>
            <select
              value={fieldKey}
              onChange={event => setFieldKey(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              {configurableFields.map(field => (
                <option key={field.key} value={field.key}>
                  {field.label} {field.source === 'custom_field' ? '(מותאם אישית)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">היקף</span>
            <select
              value={scope}
              onChange={event => {
                setScope(event.target.value as FieldRequirementScope);
                setTargetId('');
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <option value="role">תפקיד</option>
              <option value="institution">מוסד</option>
              <option value="entity_type">סוג ישות</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">יעד</span>
            <select
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <option value="">בחר</option>
              {targetOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">מצב</span>
            <select
              value={mode}
              onChange={event => setMode(event.target.value as FieldRequirementMode)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <option value="hidden">מוסתר</option>
              <option value="optional">מוצג - אופציונלי</option>
              <option value="required">מוצג - חובה</option>
              <option value="read_only">מוצג - לקריאה בלבד</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!targetId}
            className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            שמור כלל
          </button>
        </div>
        {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
      </div>
    </PanelCard>
  );
}

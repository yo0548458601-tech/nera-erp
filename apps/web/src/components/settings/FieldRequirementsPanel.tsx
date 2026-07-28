'use client';

import { useState } from 'react';
import { getRolesForEntityType } from '@nera/entity-engine';
import { type FieldRequirementMode, type FieldRequirementScope } from '@nera/customization-engine';
import { useMyPermission } from '../../context/AuthorizationContext';
import { useFieldRequirements } from '../../context/FieldRequirementContext';
import { useRoleDefinitions } from '../../context/RoleDefinitionContext';
import { useSession } from '../../context/SessionContext';
import { useConfigurableFields } from '../../config/configurableFields';
import { PanelCard } from '../PanelCard';

const modeLabels: Record<FieldRequirementMode, string> = {
  hidden: 'מוסתר',
  optional: 'מוצג - אופציונלי',
  required: 'מוצג - חובה',
  read_only: 'מוצג - לקריאה בלבד',
};
/**
 * 'institution' is deliberately excluded here (Owner decision 3, P013B):
 * FieldRequirementScope still carries an 'institution' value on the pure
 * engine type, but no institution-scoped target exists in this sprint, so
 * this settings UI never offers it as a selectable scope.
 */
const scopeLabels: Record<Exclude<FieldRequirementScope, 'institution' | 'module'>, string> = {
  role: 'תפקיד',
  entity_type: 'סוג ישות',
};

/**
 * Settings for the GENERIC field-state system (see
 * @nera/customization-engine's fieldRequirements.ts): any built-in field
 * registered in configurableFields.ts, or any active custom field, can be
 * configured here - not just birth date. An administrator picks a field
 * (from the combined built-in + custom-field catalog), a scope (role or
 * entity type) and a target, then a mode (hidden/optional/required/
 * read-only). Real, persisted rows (P013B - see docs/ROADMAP.md).
 */
export function FieldRequirementsPanel() {
  const canManage = useMyPermission('field_requirements.manage_defaults');
  const { rules, isLoading, setRule } = useFieldRequirements();
  const { roles } = useRoleDefinitions();
  const { session } = useSession();
  const personRoles = getRolesForEntityType(roles, 'person');
  const configurableFields = useConfigurableFields();

  const [fieldKey, setFieldKey] = useState(configurableFields[0]?.key ?? 'birthDate');
  const [scope, setScope] =
    useState<Exclude<FieldRequirementScope, 'institution' | 'module'>>('role');
  const [targetId, setTargetId] = useState('');
  const [mode, setMode] = useState<FieldRequirementMode>('optional');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      : scope === 'entity_type'
        ? ([{ id: 'person', label: 'אדם' }] satisfies Array<{ id: string; label: string }>)
        : [];

  const handleSubmit = async () => {
    if (!targetId) {
      return;
    }
    setIsSubmitting(true);
    setSuccessMessage('');
    await setRule(fieldKey, scope, targetId, mode, session?.user.id ?? 'demo-user');
    setIsSubmitting(false);
    setSuccessMessage('הכלל נשמר.');
    window.setTimeout(() => setSuccessMessage(''), 2500);
  };

  return (
    <PanelCard
      title="מצב שדות (חובה / אופציונלי / מוסתר / לקריאה בלבד)"
      subtitle="קביעת מצב תצוגה/חובה לכל שדה (מובנה או מותאם אישית), לפי תפקיד או סוג ישות."
    >
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <p className="text-sm text-slate-400">טוען...</p>
        ) : rules.length === 0 ? (
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
                ·{' '}
                {rule.scope === 'institution' || rule.scope === 'module'
                  ? rule.scope
                  : scopeLabels[rule.scope]}
                : {rule.targetId} → <span className="font-medium">{modeLabels[rule.mode]}</span>
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
                setScope(
                  event.target.value as Exclude<FieldRequirementScope, 'institution' | 'module'>
                );
                setTargetId('');
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <option value="role">תפקיד</option>
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
            disabled={isSubmitting || !targetId}
            className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            שמור כלל
          </button>

          {successMessage ? (
            <span className="text-sm text-emerald-600">{successMessage}</span>
          ) : null}
        </div>
      </div>
    </PanelCard>
  );
}

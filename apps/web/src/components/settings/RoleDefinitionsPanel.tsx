'use client';

import { useState, type FormEvent } from 'react';
import { type EntityType } from '@nera/entity-engine';
import { useRoleDefinitions } from '../../context/RoleDefinitionContext';
import { useMyPermission } from '../../context/AuthorizationContext';
import { PanelCard } from '../PanelCard';

const entityTypeLabels: Record<EntityType, string> = { person: 'אדם', organization: 'ארגון/חברה' };

/**
 * Settings for administrator-configurable business roles: view built-in
 * and custom roles, enable/disable any of them, and create new custom
 * roles with the same metadata built-in roles carry (applicable entity
 * type, global "הוספה חדשה" visibility, whether multiple simultaneous
 * assignments are allowed). Built-in roles can never be deleted here -
 * only hidden/shown - matching the platform rule that they ship with the
 * engine. Real, persisted rows (P013B - see docs/ROADMAP.md).
 *
 * No institution-scope control (Owner decision 3, P013B): role
 * definitions are organization-scoped only in this sprint - there is no
 * institution picker here, and none should be added until a real
 * institution-scoped target exists.
 */
export function RoleDefinitionsPanel() {
  const canManage = useMyPermission('roles.manage_definitions');
  const { roles, isLoading, addCustomRole, setRoleStatus } = useRoleDefinitions();

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [entityTypes, setEntityTypes] = useState<EntityType[]>(['person']);
  const [showInGlobalAddNew, setShowInGlobalAddNew] = useState(false);
  const [allowMultipleAssignments, setAllowMultipleAssignments] = useState(false);
  const [supportsBillingProfile, setSupportsBillingProfile] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!canManage) {
    return (
      <PanelCard title="הגדרות תפקידים עסקיים">
        <p className="text-sm text-slate-500">אין לך הרשאה לנהל הגדרות תפקידים.</p>
      </PanelCard>
    );
  }

  const toggleEntityType = (type: EntityType) => {
    setEntityTypes(current =>
      current.includes(type) ? current.filter(entry => entry !== type) : [...current, type]
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const result = await addCustomRole({
      key: key.trim(),
      label,
      description,
      applicableEntityTypes: entityTypes,
      showInGlobalAddNew,
      allowMultipleAssignments,
      supportsDateRange: true,
      supportsBillingProfile,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccessMessage(`התפקיד "${result.role?.label}" נוצר בהצלחה.`);
    setKey('');
    setLabel('');
    setDescription('');
    setEntityTypes(['person']);
    setShowInGlobalAddNew(false);
    setAllowMultipleAssignments(false);
    setSupportsBillingProfile(false);
  };

  return (
    <PanelCard
      title="הגדרות תפקידים עסקיים"
      subtitle="תפקידי המערכת המובנים מוצגים לצפייה בלבד; ניתן להוסיף תפקידים מותאמים אישית ולהשבית/להפעיל כל תפקיד."
    >
      <div className="flex flex-col gap-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-3 py-2">
                  תפקיד
                </th>
                <th scope="col" className="px-3 py-2">
                  מפתח פנימי
                </th>
                <th scope="col" className="px-3 py-2">
                  סוג ישות
                </th>
                <th scope="col" className="px-3 py-2">
                  הוספה חדשה
                </th>
                <th scope="col" className="px-3 py-2">
                  מקור
                </th>
                <th scope="col" className="px-3 py-2">
                  סטטוס
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">
                    טוען...
                  </td>
                </tr>
              ) : (
                roles.map(role => (
                  <tr key={role.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{role.label}</p>
                      {role.description ? (
                        <p className="text-xs text-slate-400">{role.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{role.key}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {role.applicableEntityTypes.map(type => entityTypeLabels[type]).join(', ')}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {role.showInGlobalAddNew ? 'כן' : 'לא'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          role.isSystem ? 'bg-slate-100 text-slate-600' : 'bg-cyan-50 text-cyan-700'
                        }`}
                      >
                        {role.isSystem ? 'מובנה' : 'מותאם אישית'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRoleStatus(role.id, role.status === 'active' ? 'inactive' : 'active')
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          role.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        {role.status === 'active' ? 'פעיל' : 'מושבת'}
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
          <p className="text-sm font-semibold text-slate-700">הוספת תפקיד מותאם אישית</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">מפתח פנימי (אנגלית) *</span>
              <input
                required
                value={key}
                onChange={event => setKey(event.target.value)}
                placeholder="לדוגמה: volunteer"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">שם התפקיד בעברית *</span>
              <input
                required
                value={label}
                onChange={event => setLabel(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">תיאור</span>
            <input
              value={description}
              onChange={event => setDescription(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                סוג ישות
              </p>
              <div className="mt-1.5 flex gap-2">
                {(['person', 'organization'] as EntityType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleEntityType(type)}
                    aria-pressed={entityTypes.includes(type)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      entityTypes.includes(type)
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {entityTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showInGlobalAddNew}
                onChange={event => setShowInGlobalAddNew(event.target.checked)}
              />
              הצג בתפריט &quot;הוספה חדשה&quot;
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allowMultipleAssignments}
                onChange={event => setAllowMultipleAssignments(event.target.checked)}
              />
              אפשר מספר שיוכים בו-זמנית לאותה ישות
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={supportsBillingProfile}
                onChange={event => setSupportsBillingProfile(event.target.checked)}
              />
              תומך בשם לחשבונית
            </label>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="self-start rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            הוסף תפקיד
          </button>
        </form>
      </div>
    </PanelCard>
  );
}

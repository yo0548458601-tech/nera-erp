'use client';

import { useState } from 'react';
import {
  findRoleDefinition,
  getRolesForEntityType,
  type PersonEntity,
  type EntityRoleId,
} from '@nera/entity-engine';
import { persistedDemoOrganizations } from '../../lib/auth/demoData';
import { useEntities } from '../../context/EntityContext';
import { useRoleDefinitions } from '../../context/RoleDefinitionContext';
import { useBillingProfiles } from '../../context/BillingProfileContext';
import { PanelCard } from '../PanelCard';
import { RoleBadge } from './RoleBadge';

/**
 * Inline "שם לחשבונית" editor for one role assignment - only rendered
 * when that assignment's role definition has supportsBillingProfile: true
 * (see roles.ts). Billing profiles are keyed by roleAssignmentId (see
 * billingProfile.ts), never by entityId, so the same person can carry a
 * different billing name per role.
 */
function BillingNameField({
  roleAssignmentId,
  entityId,
}: {
  roleAssignmentId: string;
  entityId: string;
}) {
  const { getBillingProfile, setBillingDisplayName } = useBillingProfiles();
  const existing = getBillingProfile(roleAssignmentId);
  const [draft, setDraft] = useState(existing?.billingDisplayName ?? '');
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">שם לחשבונית</span>
        <input
          value={draft}
          onChange={event => {
            setDraft(event.target.value);
            setSaved(false);
          }}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-cyan-400"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          setBillingDisplayName(roleAssignmentId, entityId, draft.trim());
          setSaved(true);
        }}
        className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white"
      >
        שמור
      </button>
      {saved ? <span className="text-xs text-emerald-600">נשמר</span> : null}
    </div>
  );
}

export function PersonRolesCard({ person }: { person: PersonEntity }) {
  const { roleAssignments, addRoleToEntity, removeRoleFromEntity } = useEntities();
  const { roles } = useRoleDefinitions();
  const personRoles = getRolesForEntityType(roles, 'person');
  const [selectedRole, setSelectedRole] = useState<EntityRoleId | ''>('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [addError, setAddError] = useState('');

  const assignments = roleAssignments.filter(assignment => assignment.entityId === person.id);
  const assignedRoleKeys = assignments
    .filter(assignment => assignment.status === 'active')
    .map(assignment => assignment.role);
  const availableRoles = personRoles.filter(
    role => role.allowMultipleAssignments || !assignedRoleKeys.includes(role.key)
  );

  const handleAdd = async () => {
    if (!selectedRole) {
      return;
    }
    const definition = findRoleDefinition(roles, selectedRole);
    const added = await addRoleToEntity(
      person.id,
      selectedRole,
      definition,
      selectedOrg || undefined
    );
    if (!added) {
      setAddError('לתפקיד זה כבר קיים שיוך פעיל, ולא מוגדר כתפקיד המאפשר מספר שיוכים בו-זמנית.');
      return;
    }
    setAddError('');
    setSelectedRole('');
    setSelectedOrg('');
  };

  return (
    <PanelCard title="תפקידים" subtitle="ישות אחת יכולה להחזיק במספר תפקידים בו-זמנית.">
      <div className="flex flex-col gap-4">
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-400">לא שויכו תפקידים.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assignments.map(assignment => {
              const definition = findRoleDefinition(roles, assignment.role);
              return (
                <li key={assignment.id} className="flex flex-col gap-2">
                  <RoleBadge
                    role={assignment.role}
                    onRemove={() => removeRoleFromEntity(person.id, assignment.id)}
                  />
                  {definition?.supportsBillingProfile ? (
                    <BillingNameField roleAssignmentId={assignment.id} entityId={person.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {availableRoles.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">הוספת תפקיד</span>
              <select
                value={selectedRole}
                onChange={event => setSelectedRole(event.target.value as EntityRoleId | '')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <option value="">בחר תפקיד</option>
                {availableRoles.map(role => (
                  <option key={role.id} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">ארגון (אופציונלי)</span>
              <select
                value={selectedOrg}
                onChange={event => setSelectedOrg(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <option value="">ללא שיוך ספציפי</option>
                {persistedDemoOrganizations.map(organization => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedRole}
              className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              הוסף תפקיד
            </button>
          </div>
        ) : null}
        {addError ? <p className="text-sm text-rose-600">{addError}</p> : null}
      </div>
    </PanelCard>
  );
}

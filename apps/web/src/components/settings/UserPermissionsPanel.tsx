'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { permissionRegistry, type PermissionDecision } from '@nera/authorization-engine';
import { useAuthorization } from '../../context/AuthorizationContext';
import { useSession } from '../../context/SessionContext';
import { PanelCard } from '../PanelCard';

const sourceLabels: Record<string, string> = {
  user: 'התאמה אישית למשתמש',
  role: 'תפקיד',
  institution: 'ברירת מחדל למוסד',
  system: 'ברירת מחדל למערכת',
  default: 'ברירת מחדל (דחייה)',
};

const decisionLabels: Record<'allow' | 'deny', string> = { allow: 'מותר', deny: 'חסום' };

/**
 * The internal authorization value stays 'inherit' (see @nera/authorization-engine)
 * - only the Hebrew label shown to administrators changed, per P007.5: "ירושה"
 * was unclear to ordinary users. The precedence itself (user override -> role
 * -> institution -> system default -> deny) is unchanged.
 */
const INHERIT_LABEL = 'לפי הגדרת התפקיד/המוסד';

/**
 * The administrator's foundation for configuring per-user permissions:
 * select a user, see the effective (resolved) value of every permission
 * plus where it comes from, and set or clear a user-level override. This
 * is a demo authorization model held in memory for the session - it is
 * not a security boundary and nothing here is permanently saved. A real
 * server-side Authorization Engine must enforce the same precedence.
 */
export function UserPermissionsPanel() {
  const { systemUsers, resolvePermission, setUserOverride, getUserOverride } = useAuthorization();
  const { session } = useSession();
  const [selectedUserId, setSelectedUserId] = useState(systemUsers[0]?.id ?? '');

  const selectedUser = systemUsers.find((user) => user.id === selectedUserId);
  const currentUserId = session?.user.id ?? 'demo-user';

  return (
    <PanelCard
      title="הרשאות משתמשים"
      subtitle='מצב הדגמה - השינויים נשמרים בזיכרון הדפדפן בלבד למשך ההדגמה ואינם מהווים אכיפה אמיתית. אכיפה בפועל תתבצע בצד השרת בעתיד.'
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <HelpCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            &quot;{INHERIT_LABEL}&quot; אומר שלא הוגדרה התאמה אישית עבור המשתמש הזה - ההרשאה האפקטיבית נקבעת לפי התפקיד שלו, לפי
            המוסד, או לפי ברירת המחדל של המערכת, לפי סדר עדיפות קבוע: התאמה אישית למשתמש ← תפקיד ← מוסד ← ברירת מחדל למערכת ← דחייה
            כברירת מחדל.
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm sm:w-64">
          <span className="font-medium text-slate-700">בחירת משתמש</span>
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            {systemUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        {selectedUser ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th scope="col" className="px-3 py-2">
                    הרשאה
                  </th>
                  <th scope="col" className="px-3 py-2">
                    ערך אפקטיבי
                  </th>
                  <th scope="col" className="px-3 py-2">
                    מקור
                  </th>
                  <th scope="col" className="px-3 py-2">
                    התאמה אישית
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissionRegistry.map((definition) => {
                  const effective = resolvePermission(definition.id, {
                    userId: selectedUser.id,
                    roleIds: selectedUser.roleIds,
                    institutionId: session?.selectedOrganizationId,
                  });
                  const override = getUserOverride(selectedUser.id, definition.id);

                  return (
                    <tr key={definition.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{definition.label}</p>
                        <p className="text-xs text-slate-400">{definition.description}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            effective.decision === 'allow' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {decisionLabels[effective.decision]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{sourceLabels[effective.source]}</td>
                      <td className="px-3 py-3">
                        <select
                          value={override}
                          onChange={(event) =>
                            setUserOverride(selectedUser.id, definition.id, event.target.value as PermissionDecision, currentUserId)
                          }
                          aria-label={`התאמה אישית עבור ${definition.label} של ${selectedUser.name}`}
                          title={`${INHERIT_LABEL}: אין התאמה אישית - ההרשאה נקבעת לפי תפקיד/מוסד/ברירת מחדל של המערכת.`}
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="inherit">{INHERIT_LABEL}</option>
                          <option value="allow">מותר במפורש</option>
                          <option value="deny">חסום במפורש</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </PanelCard>
  );
}

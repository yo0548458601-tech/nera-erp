'use client';

import { useState } from 'react';
import { getBuiltInDefaultColumnKeys } from '@nera/customization-engine';
import { useMyPermission } from '../../context/AuthorizationContext';
import { useListViewPreferences } from '../../context/ListViewPreferenceContext';
import { useSession } from '../../context/SessionContext';
import {
  CONTACTS_SCREEN_ID,
  useContactsListColumnDefinitions,
} from '../../config/contactsListColumns';
import { ColumnChooser } from '../shell/ColumnChooser';
import { PanelCard } from '../PanelCard';

const SCREEN_OPTIONS = [{ id: CONTACTS_SCREEN_ID, label: 'אנשי קשר' }];

const sourceLabels: Record<string, string> = {
  user: 'התאמה אישית למשתמש',
  role: 'תפקיד',
  institution: 'ברירת מחדל למוסד',
  system: 'ברירת מחדל למערכת',
  default: 'ברירת מחדל מובנית של המסך',
};

/**
 * Settings foundation for administrator-defined default list columns: pick
 * a target screen, choose the system-wide default visible/ordered columns
 * for it, and see the effective source (the same user -> role ->
 * institution -> system -> built-in precedence PeopleTable's ColumnChooser
 * resolves against). Only the "system" scope is editable through this
 * demo UI; role/institution-level defaults share the same underlying
 * contract (see ListViewColumnPreference) and are represented but not
 * exposed in this sprint's settings UI.
 */
export function ListViewDefaultsPanel() {
  const canManage = useMyPermission('list_views.manage_defaults');
  const { session } = useSession();
  const { getEffectiveColumns, setSystemDefaultColumns } = useListViewPreferences();
  const contactsColumnDefinitions = useContactsListColumnDefinitions();
  const [screenId] = useState(CONTACTS_SCREEN_ID);
  const [successMessage, setSuccessMessage] = useState('');

  if (!canManage) {
    return (
      <PanelCard title="עמודות ברירת מחדל ברשימות">
        <p className="text-sm text-slate-500">אין לך הרשאה לנהל עמודות ברירת מחדל.</p>
      </PanelCard>
    );
  }

  const builtInDefaultColumnKeys = getBuiltInDefaultColumnKeys(contactsColumnDefinitions);
  const effective = getEffectiveColumns(screenId, builtInDefaultColumnKeys);

  const handleSave = (visibleColumnKeys: string[]) => {
    setSystemDefaultColumns(screenId, visibleColumnKeys, session?.user.id ?? 'demo-user');
    setSuccessMessage('ברירת המחדל למערכת נשמרה.');
    window.setTimeout(() => setSuccessMessage(''), 2500);
  };

  return (
    <PanelCard
      title="עמודות ברירת מחדל ברשימות"
      subtitle="מצב הדגמה - קובע את ברירת המחדל ברמת המערכת עבור מסך הרשימה שנבחר; משתמש בודד עדיין יכול לבחור עמודות אישיות משלו."
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm sm:w-64">
          <span className="font-medium text-slate-700">מסך רשימה</span>
          <select
            disabled
            value={screenId}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            {SCREEN_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm text-slate-600">
          מקור נוכחי עבור המשתמש המחובר:{' '}
          <span className="font-medium text-slate-800">{sourceLabels[effective.source]}</span>
        </p>

        <ColumnChooser
          allColumns={contactsColumnDefinitions}
          visibleColumnKeys={
            effective.source === 'system' ? effective.visibleColumnKeys : builtInDefaultColumnKeys
          }
          onChange={handleSave}
          onReset={() => handleSave(builtInDefaultColumnKeys)}
        />

        {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
      </div>
    </PanelCard>
  );
}

'use client';

import { type PhoneDraft, type PhoneType } from '@nera/entity-engine';
import { useMyPermission } from '../../context/AuthorizationContext';
import { ListFieldEditor } from '../shared/ListFieldEditor';
import { validatePhoneNumber } from '../../lib/validation/contactMethods';

const phoneTypeLabels: Record<PhoneType, string> = { mobile: 'נייד', home: 'בית', work: 'עבודה', fax: 'פקס', other: 'אחר' };
const phoneTypes: PhoneType[] = ['mobile', 'home', 'work', 'fax', 'other'];

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyPhoneDraft(): PhoneDraft {
  return { id: createId('phone'), number: '', type: 'mobile', label: phoneTypeLabels.mobile, isPrimary: false, status: 'active', order: 0, verified: false };
}

export function PhoneListEditor({ phones, onChange, currentUserId }: { phones: PhoneDraft[]; onChange: (phones: PhoneDraft[]) => void; currentUserId: string }) {
  const canEdit = useMyPermission('contact_methods.edit');
  const canDeactivate = useMyPermission('contact_methods.deactivate');
  const canRemove = useMyPermission('contact_methods.remove');
  const canRestore = useMyPermission('contact_methods.restore');

  return (
    <ListFieldEditor
      groupName="primary-phone"
      items={phones}
      onChange={onChange}
      createItem={createEmptyPhoneDraft}
      addLabel="הוסף טלפון נוסף"
      emptyLabel="לא הוזן טלפון."
      itemAriaLabel={(item) => `טלפון ${item.number || 'חדש'}`}
      currentUserId={currentUserId}
      activeStatusLabel="פעיל"
      inactiveStatusLabel="לא פעיל"
      deactivateActionLabel="הפוך ללא פעיל"
      reactivateActionLabel="הפעל מחדש"
      removeActionLabel="הסר טלפון"
      removeConfirmMessage="להסיר את הטלפון? ניתן יהיה לשחזר אותו מהרשימה 'טלפונים שהוסרו'."
      removedSectionLabel="טלפונים שהוסרו"
      canEdit={canEdit}
      canDeactivate={canDeactivate}
      canRemove={canRemove}
      canRestore={canRestore}
      renderFields={(item, update) => {
        const error = item.number ? validatePhoneNumber(item.number) : null;
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-600">מספר טלפון *</span>
              <input
                value={item.number}
                onChange={(event) => update({ number: event.target.value })}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400"
              />
              {error ? <span className="text-[11px] text-rose-600">{error}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-600">סוג</span>
              <select
                value={item.type}
                onChange={(event) => {
                  const type = event.target.value as PhoneType;
                  update({ type, label: item.label === phoneTypeLabels[item.type] ? phoneTypeLabels[type] : item.label });
                }}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
              >
                {phoneTypes.map((type) => (
                  <option key={type} value={type}>
                    {phoneTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="font-medium text-slate-600">תווית (עברית)</span>
              <input
                value={item.label}
                onChange={(event) => update({ label: event.target.value })}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>
        );
      }}
    />
  );
}

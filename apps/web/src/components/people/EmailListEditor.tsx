'use client';

import { type EmailDraft, type EmailType } from '@nera/entity-engine';
import { useMyPermission } from '../../context/AuthorizationContext';
import { ListFieldEditor } from '../shared/ListFieldEditor';
import { EmailInput } from '../shared/EmailInput';
import { validateEmailAddress } from '../../lib/validation/contactMethods';

const emailTypeLabels: Record<EmailType, string> = { personal: 'אישי', work: 'עבודה', billing: 'חיוב', notifications: 'התראות', other: 'אחר' };
const emailTypes: EmailType[] = ['personal', 'work', 'billing', 'notifications', 'other'];

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyEmailDraft(): EmailDraft {
  return { id: createId('email'), address: '', type: 'personal', label: emailTypeLabels.personal, isPrimary: false, status: 'active', order: 0, verified: false };
}

export function EmailListEditor({ emails, onChange, currentUserId }: { emails: EmailDraft[]; onChange: (emails: EmailDraft[]) => void; currentUserId: string }) {
  const canEdit = useMyPermission('contact_methods.edit');
  const canDeactivate = useMyPermission('contact_methods.deactivate');
  const canRemove = useMyPermission('contact_methods.remove');
  const canRestore = useMyPermission('contact_methods.restore');

  return (
    <ListFieldEditor
      groupName="primary-email"
      items={emails}
      onChange={onChange}
      createItem={createEmptyEmailDraft}
      addLabel='הוסף כתובת דוא"ל נוספת'
      emptyLabel='לא הוזנה כתובת דוא"ל.'
      itemAriaLabel={(item) => `דוא"ל ${item.address || 'חדש'}`}
      currentUserId={currentUserId}
      activeStatusLabel="פעילה"
      inactiveStatusLabel="לא פעילה"
      deactivateActionLabel="הפוך ללא פעילה"
      reactivateActionLabel="הפעל מחדש"
      removeActionLabel='הסר כתובת דוא"ל'
      removeConfirmMessage='להסיר את כתובת הדוא"ל? ניתן יהיה לשחזר אותה מהרשימה "כתובות דוא"ל שהוסרו".'
      removedSectionLabel='כתובות דוא"ל שהוסרו'
      canEdit={canEdit}
      canDeactivate={canDeactivate}
      canRemove={canRemove}
      canRestore={canRestore}
      renderFields={(item, update) => {
        const error = item.address ? validateEmailAddress(item.address) : null;
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="font-medium text-slate-600">כתובת דוא&quot;ל *</span>
              <EmailInput
                value={item.address}
                onChange={(value) => update({ address: value })}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400"
              />
              {error ? <span className="text-[11px] text-rose-600">{error}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-600">סוג</span>
              <select
                value={item.type}
                onChange={(event) => {
                  const type = event.target.value as EmailType;
                  update({ type, label: item.label === emailTypeLabels[item.type] ? emailTypeLabels[type] : item.label });
                }}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
              >
                {emailTypes.map((type) => (
                  <option key={type} value={type}>
                    {emailTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
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

'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  detectPotentialDuplicates,
  getRolesForEntityType,
  type AddressDraft,
  type DuplicateMatchReason,
  type EmailDraft,
  type EntityRoleId,
  type EntityStatus,
  type PersonEntity,
  type PersonGender,
  type PhoneDraft,
} from '@nera/entity-engine';
import { useDismissableOverlay } from '../../hooks/useDismissableOverlay';
import { useEntities } from '../../context/EntityContext';
import { useSession } from '../../context/SessionContext';
import { useMyPermission } from '../../context/AuthorizationContext';
import { useRoleDefinitions } from '../../context/RoleDefinitionContext';
import { useFieldRequirements } from '../../context/FieldRequirementContext';
import { type HebrewDateAdjustment } from '../../lib/dates/hebrewBirthDate';
import { arePhoneDraftsValid, areEmailDraftsValid } from '../../lib/validation/contactMethods';
import { DuplicateConflictPanel } from './DuplicateConflictPanel';
import { HebrewBirthDateField } from './HebrewBirthDateField';
import { PhoneListEditor } from './PhoneListEditor';
import { EmailListEditor } from './EmailListEditor';
import { AddressListEditor } from './AddressListEditor';

type PersonFormMode = 'create' | 'edit';

type PersonFormDialogProps = {
  open: boolean;
  onClose: () => void;
  mode: PersonFormMode;
  /** Required when mode is 'edit'. */
  person?: PersonEntity;
  onCreated?: (person: PersonEntity) => void;
  onSaved?: (person: PersonEntity) => void;
  restoreFocusRef?: RefObject<HTMLElement>;
  /** Preselected roles when opened from a role-specific quick-add shortcut (e.g. "אברך"). Create mode only. */
  initialRoles?: EntityRoleId[];
};

const duplicateReasonLabels: Record<DuplicateMatchReason, string> = {
  idNumber: 'מספר זהות',
  registrationNumber: 'מספר רישום',
  phone: 'טלפון',
  email: 'דוא"ל',
  similarName: 'שם דומה',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function toPhoneDraft(phone: PersonEntity['profile']['phones'][number]): PhoneDraft {
  const { entityId: _entityId, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = phone;
  return draft;
}

function toEmailDraft(email: PersonEntity['profile']['emails'][number]): EmailDraft {
  const { entityId: _entityId, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = email;
  return draft;
}

function toAddressDraft(address: PersonEntity['profile']['addresses'][number]): AddressDraft {
  const { entityId: _entityId, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = address;
  return draft;
}

const inputClassName = 'rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-400';

/**
 * One reusable form for both creating a new person and editing an
 * existing one - the same fields, the same validation, the same duplicate
 * detection. Editing never touches id/neraId/tenantId. Phones, emails and
 * addresses are each edited as a full list (see PhoneListEditor /
 * EmailListEditor / AddressListEditor) - the form IS the complete source
 * of truth for these arrays while open, so every existing entry not
 * explicitly removed by the user is preserved on save, and multiple
 * entries were never limited to one.
 */
export function PersonFormDialog({ open, onClose, mode, person, onCreated, onSaved, restoreFocusRef, initialRoles }: PersonFormDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { entities, roleAssignments, addPerson, updatePerson, recordDuplicateOverride } = useEntities();
  const { session } = useSession();
  const { roles } = useRoleDefinitions();
  const { resolveForRoles } = useFieldRequirements();
  const personRoles = getRolesForEntityType(roles, 'person');
  const canOverrideDuplicate = useMyPermission('entities.duplicate_override');
  const canViewBirthDate = useMyPermission('birth_date.view');
  const canEditBirthDate = useMyPermission('birth_date.edit');
  const currentUserId = session?.user.id ?? 'demo-user';

  useDismissableOverlay(open, onClose, [panelRef], { restoreFocusRef });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [birthDateGregorian, setBirthDateGregorian] = useState('');
  const [hebrewDateAdjustmentDays, setHebrewDateAdjustmentDays] = useState<HebrewDateAdjustment>(0);
  const [gender, setGender] = useState<PersonGender>('unspecified');
  const [status, setStatus] = useState<EntityStatus>('active');
  const [phones, setPhones] = useState<PhoneDraft[]>([]);
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [addresses, setAddresses] = useState<AddressDraft[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<EntityRoleId[]>(initialRoles ?? ['contact']);
  const [error, setError] = useState('');

  const loadFromPerson = (target: PersonEntity | undefined) => {
    if (!target) {
      setFirstName('');
      setLastName('');
      setIdNumber('');
      setBirthDateGregorian('');
      setHebrewDateAdjustmentDays(0);
      setGender('unspecified');
      setStatus('active');
      setPhones([]);
      setEmails([]);
      setAddresses([]);
      setTagsInput('');
      setSelectedRoles(initialRoles ?? ['contact']);
      return;
    }
    setFirstName(target.profile.firstName);
    setLastName(target.profile.lastName);
    setIdNumber(target.profile.idNumber ?? '');
    setBirthDateGregorian(target.profile.birthDateGregorian ?? '');
    setHebrewDateAdjustmentDays(target.profile.hebrewDateAdjustmentDays);
    setGender(target.profile.gender);
    setStatus(target.status);
    setPhones(target.profile.phones.map(toPhoneDraft));
    setEmails(target.profile.emails.map(toEmailDraft));
    setAddresses(target.profile.addresses.map(toAddressDraft));
    setTagsInput(target.tags.join(', '));
  };

  /**
   * Changing the Gregorian date resets the adjustment to 0 by default: the
   * adjustment corrects for uncertainty around ONE specific date, so
   * carrying it over to a newly entered date would silently misapply an
   * unrelated correction. There is no case in this sprint where carrying
   * it over is the documented exception.
   */
  const handleBirthDateChange = (value: string) => {
    setBirthDateGregorian(value);
    setHebrewDateAdjustmentDays(0);
  };

  // Load current values whenever the dialog opens, so cancel-without-saving is always safe.
  useEffect(() => {
    if (open) {
      loadFromPerson(mode === 'edit' ? person : undefined);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, person?.id]);

  /**
   * Birth-date applicability is configurable (see FieldRequirementContext)
   * by role/institution/entity type - never hardcoded. In edit mode this
   * uses the person's actual current role assignments, not the create-only
   * role picker's selectedRoles state (which stays at its initial value in
   * edit mode, since the picker UI itself is create-only).
   */
  const effectiveRoleKeysForBirthDate =
    mode === 'create' ? selectedRoles : roleAssignments.filter((assignment) => assignment.entityId === person?.id && assignment.status === 'active').map((assignment) => assignment.role);
  const birthDateMode = resolveForRoles('birthDate', 'person', effectiveRoleKeysForBirthDate, session?.selectedOrganizationId);
  const showBirthDate = canViewBirthDate && birthDateMode !== 'hidden';
  const birthDateRequired = birthDateMode === 'required';
  /** Read-only when EITHER the configured field state says read-only, OR the signed-in user simply lacks the edit permission - two independent axes (configuration vs authorization) that both result in the same non-editable rendering. */
  const birthDateReadOnly = birthDateMode === 'read_only' || !canEditBirthDate;

  const activePhones = useMemo(() => phones.filter((phone) => phone.status === 'active' && !phone.deletedAt && phone.number.trim()), [phones]);
  const activeEmails = useMemo(() => emails.filter((email) => email.status === 'active' && !email.deletedAt && email.address.trim()), [emails]);

  const duplicateMatches = useMemo(() => {
    if (!idNumber.trim() && activePhones.length === 0 && activeEmails.length === 0 && !(firstName.trim() && lastName.trim())) {
      return [];
    }
    return detectPotentialDuplicates(
      {
        idNumber: idNumber.trim() || undefined,
        displayName: firstName.trim() && lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : undefined,
        phones: activePhones.map((phone) => ({ number: phone.number })),
        emails: activeEmails.map((email) => ({ address: email.address })),
      },
      entities,
      mode === 'edit' ? person?.id : undefined,
    );
  }, [idNumber, activePhones, activeEmails, firstName, lastName, entities, mode, person?.id]);

  const blockingMatches = duplicateMatches.filter((match) => match.isBlocking);
  const nonBlockingMatches = duplicateMatches.filter((match) => !match.isBlocking);

  const handleClose = () => {
    loadFromPerson(mode === 'edit' ? person : undefined);
    setError('');
    onClose();
  };

  const toggleRole = (role: EntityRoleId) => {
    setSelectedRoles((current) => (current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role]));
  };

  const buildAndSave = (): PersonEntity | undefined => {
    if (mode === 'create') {
      return addPerson({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        idNumber: idNumber.trim() || undefined,
        birthDateGregorian: birthDateGregorian || undefined,
        hebrewDateAdjustmentDays,
        gender,
        phones,
        emails,
        addresses,
        tags: tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        roles: selectedRoles,
      });
    }

    if (!person) {
      return undefined;
    }
    return updatePerson(
      person.id,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        idNumber: idNumber.trim() || undefined,
        birthDateGregorian: birthDateGregorian || undefined,
        hebrewDateAdjustmentDays,
        gender,
        status,
        tags: tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        phones,
        emails,
        addresses,
      },
      currentUserId,
    );
  };

  const finishSuccess = (result: PersonEntity) => {
    onClose();
    if (mode === 'create') {
      onCreated?.(result);
    } else {
      onSaved?.(result);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError('יש למלא שם פרטי ושם משפחה.');
      return;
    }

    if (showBirthDate && birthDateRequired && !birthDateGregorian) {
      setError('תאריך לידה הוא שדה חובה עבור התפקיד/המוסד שנבחרו.');
      return;
    }

    if (!arePhoneDraftsValid(phones)) {
      setError('אחד ממספרי הטלפון אינו תקין.');
      return;
    }

    if (!areEmailDraftsValid(emails)) {
      setError('אחת מכתובות הדוא"ל אינה תקינה.');
      return;
    }

    if (blockingMatches.length > 0) {
      setError('נמצאה התאמה מדויקת עם רשומה קיימת. יש לפתוח את הרשומה הקיימת או לאשר יצירת רשומה נפרדת בפאנל שלמעלה.');
      return;
    }

    const result = buildAndSave();
    if (result) {
      finishSuccess(result);
    }
  };

  const handleOpenExisting = (entityId: string) => {
    onClose();
    router.push(`/contacts/${entityId}`);
  };

  const handleConfirmOverride = (reason: string) => {
    const result = buildAndSave();
    if (!result) {
      return;
    }
    recordDuplicateOverride(
      result.id,
      blockingMatches.map((match) => match.entity.id),
      blockingMatches.flatMap((match) => match.reasons),
      reason,
      currentUserId,
    );
    finishSuccess(result);
  };

  if (!open) {
    return null;
  }

  const title = mode === 'create' ? 'הוספת איש קשר חדש' : `עריכת ${firstName} ${lastName}`.trim();
  const submitLabel = mode === 'create' ? 'צור איש קשר' : 'שמור שינויים';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={handleClose} className="text-sm text-slate-500">
            סגור
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="שם פרטי *">
              <input required value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClassName} />
            </Field>
            <Field label="שם משפחה *">
              <input required value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClassName} />
            </Field>
            <Field label="מספר זהות">
              <input value={idNumber} onChange={(event) => setIdNumber(event.target.value)} className={inputClassName} />
            </Field>
            {showBirthDate ? (
              <Field label={`תאריך לידה (לועזי)${birthDateRequired ? ' *' : ''}${birthDateReadOnly ? ' (לקריאה בלבד)' : ''}`}>
                <input
                  type="date"
                  required={birthDateRequired}
                  readOnly={birthDateReadOnly}
                  value={birthDateGregorian}
                  onChange={(event) => handleBirthDateChange(event.target.value)}
                  className={inputClassName}
                />
              </Field>
            ) : null}
            {showBirthDate && birthDateGregorian ? (
              <HebrewBirthDateField
                birthDateGregorian={birthDateGregorian}
                adjustmentDays={hebrewDateAdjustmentDays}
                onAdjustmentChange={birthDateReadOnly ? () => undefined : setHebrewDateAdjustmentDays}
              />
            ) : null}
            <Field label="מגדר">
              <select value={gender} onChange={(event) => setGender(event.target.value as PersonGender)} className={inputClassName}>
                <option value="unspecified">לא מוגדר</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </Field>
            {mode === 'edit' ? (
              <Field label="סטטוס">
                <select value={status} onChange={(event) => setStatus(event.target.value as EntityStatus)} className={inputClassName}>
                  <option value="active">פעיל</option>
                  <option value="inactive">לא פעיל</option>
                  <option value="archived">בארכיון</option>
                </select>
              </Field>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">
              טלפון
              {phones.filter((phone) => !phone.deletedAt).length > 1 ? ` (${phones.filter((phone) => !phone.deletedAt).length})` : ''}
            </p>
            <div className="mt-2">
              <PhoneListEditor phones={phones} onChange={setPhones} currentUserId={currentUserId} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">
              כתובת דוא&quot;ל
              {emails.filter((email) => !email.deletedAt).length > 1 ? ` (${emails.filter((email) => !email.deletedAt).length})` : ''}
            </p>
            <div className="mt-2">
              <EmailListEditor emails={emails} onChange={setEmails} currentUserId={currentUserId} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">
              כתובת
              {addresses.filter((address) => !address.deletedAt).length > 1 ? ` (${addresses.filter((address) => !address.deletedAt).length})` : ''}
            </p>
            <div className="mt-2">
              <AddressListEditor addresses={addresses} onChange={setAddresses} currentUserId={currentUserId} />
            </div>
          </div>

          <Field label="תגיות (מופרדות בפסיק)">
            <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} className={inputClassName} />
          </Field>

          {mode === 'create' ? (
            <div>
              <p className="text-sm font-medium text-slate-700">תפקידים ראשוניים</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {personRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.key)}
                    aria-pressed={selectedRoles.includes(role.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selectedRoles.includes(role.key)
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {nonBlockingMatches.length > 0 ? (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">ייתכן שרשומה זו כבר קיימת במערכת:</p>
              <ul className="mt-2 space-y-1">
                {nonBlockingMatches.map((match) => (
                  <li key={match.entity.id}>
                    {match.entity.neraId} — התאמה לפי {match.reasons.map((reason) => duplicateReasonLabels[reason]).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {blockingMatches.length > 0 ? (
            <DuplicateConflictPanel
              matches={blockingMatches}
              canOverride={canOverrideDuplicate}
              onOpenExisting={handleOpenExisting}
              onConfirmOverride={handleConfirmOverride}
            />
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={handleClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
              ביטול
            </button>
            <button
              type="submit"
              disabled={blockingMatches.length > 0}
              className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

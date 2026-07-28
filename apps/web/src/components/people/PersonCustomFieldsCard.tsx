'use client';

import { useState } from 'react';
import { type PermissionId } from '@nera/authorization-engine';
import { getFieldsForEntityType, type CustomFieldValueData } from '@nera/customization-engine';
import { type PersonEntity } from '@nera/entity-engine';
import { useCustomFields } from '../../context/CustomFieldContext';
import { useSession } from '../../context/SessionContext';
import { useAuthorization } from '../../context/AuthorizationContext';
import { PanelCard } from '../PanelCard';
import { CustomFieldInput, formatCustomFieldValue } from '../customFields/CustomFieldInput';

/**
 * A small, safe demo location proving the custom-field platform end to
 * end: definitions come from CustomFieldContext (administrator-configurable
 * via settings), values are typed and validated through
 * @nera/customization-engine, and this card is a rendering extension point
 * rather than a redesign of the main person form. Every field shown here
 * is a MODULE-level attribute (see moduleProfile.ts) - never an identity
 * field like name/phone/email, which always come from the shared Entity
 * Engine profile.
 */
export function PersonCustomFieldsCard({ person }: { person: PersonEntity }) {
  const { definitions, getValue, setValue } = useCustomFields();
  const { session } = useSession();
  const { resolveMyPermission } = useAuthorization();
  const currentUserId = session?.user.id ?? 'demo-user';
  const [drafts, setDrafts] = useState<Record<string, CustomFieldValueData>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [savedFieldId, setSavedFieldId] = useState<string | null>(null);

  /**
   * Per-field view/edit permissions (see CustomFieldDefinition) are
   * enforced here for the demo: a field with no configured permission is
   * visible/editable like any other module attribute; a field with one
   * configured is hidden entirely when view is denied, or shown read-only
   * when only edit is denied. This is still a client-side demo check, not
   * a security boundary - see AuthorizationContext's docstring.
   */
  const fields = getFieldsForEntityType(definitions, 'person')
    .filter(definition => definition.showInDetail)
    .filter(
      definition =>
        !definition.viewPermission ||
        resolveMyPermission(definition.viewPermission as PermissionId).decision === 'allow'
    );

  if (fields.length === 0) {
    return null;
  }

  const handleSave = async (definitionId: string) => {
    const stored = getValue(person.id, definitionId);
    const draft = drafts[definitionId] ?? stored?.value;
    if (!draft) {
      return;
    }
    const validationErrors = await setValue(person.id, definitionId, draft, currentUserId);
    setErrors(current => ({ ...current, [definitionId]: validationErrors }));
    if (validationErrors.length === 0) {
      setSavedFieldId(definitionId);
      window.setTimeout(
        () => setSavedFieldId(current => (current === definitionId ? null : current)),
        2000
      );
    }
  };

  return (
    <PanelCard
      title="שדות מותאמים אישית"
      subtitle="הדגמה של פלטפורמת השדות המותאמים אישית - הגדרות זמינות דרך הגדרות המערכת."
    >
      <div className="flex flex-col gap-4">
        {fields.map(definition => {
          const stored = getValue(person.id, definition.id);
          const currentValue = drafts[definition.id] ?? stored?.value;
          const fieldErrors = errors[definition.id] ?? [];
          const canEdit =
            !definition.editPermission ||
            resolveMyPermission(definition.editPermission as PermissionId).decision === 'allow';

          return (
            <div
              key={definition.id}
              className="flex flex-col gap-1.5 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
            >
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-700">
                  {definition.label}
                  {definition.required ? ' *' : ''}
                </span>
                {definition.description ? (
                  <span className="text-xs text-slate-400">{definition.description}</span>
                ) : null}
                {canEdit ? (
                  <CustomFieldInput
                    definition={definition}
                    value={currentValue}
                    onChange={value =>
                      setDrafts(current => ({ ...current, [definition.id]: value }))
                    }
                  />
                ) : (
                  <span className="text-sm text-slate-500">
                    {formatCustomFieldValue(stored?.value)}
                  </span>
                )}
              </label>
              {canEdit ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSave(definition.id)}
                    className="self-start rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    שמור ערך
                  </button>
                  {savedFieldId === definition.id ? (
                    <span className="text-xs font-medium text-emerald-600">נשמר</span>
                  ) : null}
                  <span className="text-xs text-slate-400">
                    ערך נוכחי: {formatCustomFieldValue(stored?.value)}
                  </span>
                </div>
              ) : null}
              {fieldErrors.length > 0 ? (
                <ul className="text-xs text-rose-600">
                  {fieldErrors.map(error => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

/**
 * Reconciles one contact-method list (phones/emails/addresses) against the
 * form's submitted draft array (P013A - Owner-flagged fix: person editing
 * must persist phones/emails/addresses, not just scalar profile fields).
 *
 * The form is the complete source of truth for the list while open (see
 * PersonFormDialog.tsx's own doc comment), so every existing id is always
 * present in `drafts`, possibly with `deletedAt` set (a "removed" entry,
 * not an absent one - see SoftDeletable in contactMethods.ts). There is
 * therefore no "delete rows missing from the array" pass: an id already
 * known to the database is updated in place (including its
 * deletedAt/isPrimary/status - update() is a full overwrite of the
 * editable fields, matching stampContactMethods' pre-P013A semantics); an
 * id the database has never seen is a new entry and is created.
 *
 * Kept in its own plain module (not inside entityActions.ts, a `'use
 * server'` file) specifically so it can be unit-tested directly - Next.js
 * requires every export of a `'use server'` file to itself be an async
 * Server Action, which this reconciliation helper is not.
 */
export async function reconcileContactMethods<TDraft extends { id: string; isPrimary: boolean }>(
  drafts: TDraft[],
  existingIds: Set<string>,
  entityId: string,
  organizationId: string,
  add: (data: TDraft & { entityId: string; organizationId: string }) => Promise<unknown>,
  update: (id: string, organizationId: string, data: TDraft) => Promise<unknown>
): Promise<void> {
  for (const draft of drafts) {
    if (existingIds.has(draft.id)) {
      await update(draft.id, organizationId, draft);
    } else {
      await add({ ...draft, entityId, organizationId });
    }
  }
}

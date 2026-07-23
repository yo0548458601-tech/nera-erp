/**
 * A past version of a note's content, preserved whenever the note is
 * edited. Editing a note must push its pre-edit content here rather than
 * silently overwriting history.
 */
export type NoteRevision = {
  id: string;
  content: string;
  editedAt: string;
  editedByUserId: string;
};

/**
 * A collaborative note attached to an entity. Notes are their own
 * top-level collection (each referencing entityId), matching how a future
 * `entity_notes` database table would relate to `entities`.
 *
 * Deletion is soft-delete only: deletedAt/deletedByUserId are set, the
 * record is never actually removed, and it remains recoverable. Who may
 * delete a note is an authorization decision made by the caller (see the
 * app's demo permission context) - this type only records what happened,
 * it does not enforce who is allowed to do it. Real enforcement belongs to
 * a server-side Authorization Engine, not to this data shape.
 */
export type Note = {
  id: string;
  entityId: string;
  content: string;
  createdByUserId: string;
  createdAt: string;
  updatedByUserId?: string;
  updatedAt: string;
  /**
   * Lightweight "this note has been edited" signal (P013A - Owner-approved
   * design review: no `note_revisions` table; `audit_logs` remains the only
   * historical record of prior content). Set whenever content changes after
   * creation. `revisions` below is kept for backward compatibility with any
   * purely in-memory usage; persisted notes populate `editedAt`, not
   * `revisions` (always `[]` for a DB-backed note).
   */
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedByUserId?: string | null;
  /** Prior versions of `content`, oldest first. Never cleared on edit. Always `[]` for a DB-backed note - see `editedAt`. */
  revisions: NoteRevision[];
};

export function isNoteEdited(note: Note): boolean {
  return Boolean(note.editedAt) || note.revisions.length > 0;
}

export function isNoteDeleted(note: Note): boolean {
  return Boolean(note.deletedAt);
}

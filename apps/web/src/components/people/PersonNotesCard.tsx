'use client';

import { useState, type FormEvent } from 'react';
import { isNoteDeleted, isNoteEdited, type Note, type PersonEntity } from '@nera/entity-engine';
import { demoUser } from '../../lib/auth/demoData';
import { useEntities } from '../../context/EntityContext';
import { useMyPermission } from '../../context/AuthorizationContext';
import { PanelCard } from '../PanelCard';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Demo-only author resolution: the real system resolves createdByUserId through a Users service. */
function resolveUserName(userId: string): string {
  return userId === demoUser.id ? demoUser.name : userId;
}

export function PersonNotesCard({ person }: { person: PersonEntity }) {
  const { getNotesForEntity, addNote, editNote, softDeleteNote, restoreNote } = useEntities();
  const canEditNotes = useMyPermission('notes.edit');
  const canDeleteNotes = useMyPermission('notes.delete');
  const canRestoreNotes = useMyPermission('notes.restore');
  const [draft, setDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const currentUserId = demoUser.id;

  const allNotes = getNotesForEntity(person.id);
  const activeNotes = allNotes.filter((note) => !isNoteDeleted(note));
  const deletedNotes = allNotes.filter((note) => isNoteDeleted(note));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    addNote(person.id, draft, currentUserId);
    setDraft('');
  };

  const startEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditDraft(note.content);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditDraft('');
  };

  const submitEdit = (noteId: string) => {
    if (!editDraft.trim()) {
      return;
    }
    editNote(noteId, editDraft, currentUserId);
    cancelEdit();
  };

  return (
    <PanelCard title="הערות">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="הוספת הערה חדשה"
          aria-label="הוספת הערה חדשה"
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        />
        <button type="submit" className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">
          הוסף הערה
        </button>
      </form>

      {activeNotes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">אין הערות עדיין.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {activeNotes.map((note) => {
            const isEditing = editingNoteId === note.id;
            const edited = isNoteEdited(note);

            return (
              <li key={note.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      rows={2}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitEdit(note.id)}
                        className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        שמור
                      </button>
                      <button type="button" onClick={cancelEdit} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-700">{note.content}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-medium text-slate-500">{resolveUserName(note.createdByUserId)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(note.createdAt)}</span>
                      {edited ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">נערך</span> : null}
                    </div>
                    <div className="mt-2 flex gap-3 text-xs">
                      {canEditNotes ? (
                        <button type="button" onClick={() => startEdit(note)} className="font-medium text-cyan-700">
                          ערוך
                        </button>
                      ) : null}
                      {canDeleteNotes ? (
                        <button
                          type="button"
                          onClick={() => softDeleteNote(note.id, currentUserId)}
                          className="font-medium text-rose-600"
                        >
                          מחק
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canRestoreNotes && deletedNotes.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button type="button" onClick={() => setShowDeleted((value) => !value)} className="text-xs font-medium text-slate-500">
            {showDeleted ? 'הסתר' : 'הצג'} הערות שנמחקו ({deletedNotes.length})
          </button>
          {showDeleted ? (
            <ul className="mt-2 space-y-2">
              {deletedNotes.map((note) => (
                <li key={note.id} className="rounded-2xl border border-dashed border-slate-200 bg-white p-3 opacity-70">
                  <p className="text-sm text-slate-500 line-through">{note.content}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    נמחקה על ידי {note.deletedByUserId ? resolveUserName(note.deletedByUserId) : '—'}
                    {note.deletedAt ? ` · ${formatDateTime(note.deletedAt)}` : ''}
                  </p>
                  <button type="button" onClick={() => restoreNote(note.id)} className="mt-2 text-xs font-medium text-cyan-700">
                    שחזר הערה
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </PanelCard>
  );
}

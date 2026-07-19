'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  canAssignRole,
  diffEntityFields,
  formatNeraId,
  getPrimaryEmail,
  getPrimaryPhone,
  type Address,
  type AddressDraft,
  type DuplicateMatchReason,
  type DuplicateOverrideRecord,
  type Email,
  type EmailDraft,
  type EntityFieldChange,
  type EntityRoleId,
  type NewPersonInput,
  type Note,
  type PersonEntity,
  type Phone,
  type PhoneDraft,
  type RoleAssignment,
  type RoleDefinition,
  type UpdatePersonInput,
} from '@nera/entity-engine';
import {
  demoNotes,
  demoPersonEntities,
  demoRoleAssignments,
} from '../lib/entities/demoEntitiesData';

const DEMO_TENANT_ID = 'tenant-demo';
const NEXT_NERA_ID_SEQUENCE_START = 200;

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Stamps a list of form drafts (phones/emails/addresses) into full
 * records for `entityId`: createdAt is preserved from the matching
 * previous record when one exists (by id), or set to `now` for a
 * genuinely new entry; updatedAt is always `now`. This is what lets the
 * edit form submit its complete, user-managed list on every save without
 * losing each record's original creation time or silently touching
 * entries the user didn't change.
 */
function stampContactMethods<
  TDraft extends { id: string },
  TFull extends TDraft & { entityId: string; createdAt: string; updatedAt: string },
>(drafts: TDraft[], entityId: string, previous: TFull[], now: string): TFull[] {
  return drafts.map(draft => {
    const existing = previous.find(entry => entry.id === draft.id);
    return { ...draft, entityId, createdAt: existing?.createdAt ?? now, updatedAt: now } as TFull;
  });
}

type EntityContextValue = {
  /** Only person entities exist so far; this will widen to include organizations without changing the shape of this context. */
  entities: PersonEntity[];
  roleAssignments: RoleAssignment[];
  notes: Note[];
  fieldHistory: EntityFieldChange[];
  duplicateOverrides: DuplicateOverrideRecord[];
  getEntityById: (id: string) => PersonEntity | undefined;
  addPerson: (input: NewPersonInput) => PersonEntity;
  updatePerson: (
    entityId: string,
    input: UpdatePersonInput,
    updatedByUserId: string
  ) => PersonEntity | undefined;
  addRoleToEntity: (
    entityId: string,
    role: EntityRoleId,
    roleDefinition: RoleDefinition | undefined,
    organizationId?: string
  ) => boolean;
  removeRoleFromEntity: (entityId: string, roleAssignmentId: string) => void;
  getNotesForEntity: (entityId: string) => Note[];
  addNote: (entityId: string, content: string, authorUserId: string) => void;
  editNote: (noteId: string, content: string, editorUserId: string) => void;
  softDeleteNote: (noteId: string, deleterUserId: string) => void;
  restoreNote: (noteId: string) => void;
  getHistoryForEntity: (entityId: string) => EntityFieldChange[];
  recordDuplicateOverride: (
    entityId: string,
    matchedEntityIds: string[],
    reasons: DuplicateMatchReason[],
    reason: string,
    decidedByUserId: string
  ) => void;
};

const EntityContext = createContext<EntityContextValue | undefined>(undefined);

/**
 * Holds the Entity Engine's in-memory demo dataset for the whole
 * authenticated app: entities, their role assignments, their notes, their
 * field-change history and their recorded duplicate-override decisions are
 * five separate collections (each referencing entityId), so the list page,
 * detail pages, global search and the "add new" quick action all read and
 * write the same data. There is no backend in this sprint - state resets
 * on reload, same as the rest of the P006 demo shell.
 */
export function EntityProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<PersonEntity[]>(demoPersonEntities);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>(demoRoleAssignments);
  const [notes, setNotes] = useState<Note[]>(demoNotes);
  const [fieldHistory, setFieldHistory] = useState<EntityFieldChange[]>([]);
  const [duplicateOverrides, setDuplicateOverrides] = useState<DuplicateOverrideRecord[]>([]);
  const [nextNeraIdSequence, setNextNeraIdSequence] = useState(NEXT_NERA_ID_SEQUENCE_START);

  const getEntityById = useCallback(
    (id: string) => entities.find(entity => entity.id === id),
    [entities]
  );

  const addPerson = useCallback(
    (input: NewPersonInput): PersonEntity => {
      const now = new Date().toISOString();
      const entityId = createId('person');
      const neraId = formatNeraId(nextNeraIdSequence);

      const newEntity: PersonEntity = {
        id: entityId,
        neraId,
        entityType: 'person',
        status: 'active',
        tenantId: DEMO_TENANT_ID,
        tags: input.tags,
        notesMetadata: { count: 0 },
        createdAt: now,
        updatedAt: now,
        profile: {
          entityId,
          firstName: input.firstName,
          lastName: input.lastName,
          idNumber: input.idNumber,
          birthDateGregorian: input.birthDateGregorian,
          hebrewDateAdjustmentDays: input.hebrewDateAdjustmentDays,
          gender: input.gender,
          phones: stampContactMethods<PhoneDraft, Phone>(input.phones, entityId, [], now),
          emails: stampContactMethods<EmailDraft, Email>(input.emails, entityId, [], now),
          addresses: stampContactMethods<AddressDraft, Address>(input.addresses, entityId, [], now),
        },
      };

      const newRoleAssignments: RoleAssignment[] = input.roles.map(role => ({
        id: createId('role'),
        entityId,
        role,
        status: 'active',
        createdAt: now,
      }));

      setEntities(current => [...current, newEntity]);
      setRoleAssignments(current => [...current, ...newRoleAssignments]);
      setNextNeraIdSequence(current => current + 1);

      return newEntity;
    },
    [nextNeraIdSequence]
  );

  /**
   * Updates an existing person's identity/contact fields. The permanent
   * neraId, id and tenantId are never touched. Phones, emails and
   * addresses are each replaced by the input's full array (see
   * UpdatePersonInput / PersonFormDialog) - the edit form is itself the
   * complete source of truth for these lists while open, so nothing is
   * silently dropped; stampContactMethods preserves each existing record's
   * original createdAt by matching on id. Every changed field is recorded
   * in fieldHistory (see history.ts) rather than silently overwritten.
   */
  const updatePerson = useCallback(
    (
      entityId: string,
      input: UpdatePersonInput,
      updatedByUserId: string
    ): PersonEntity | undefined => {
      let updated: PersonEntity | undefined;

      setEntities(current =>
        current.map(entity => {
          if (entity.id !== entityId) {
            return entity;
          }

          const now = new Date().toISOString();

          const phones = stampContactMethods<PhoneDraft, Phone>(
            input.phones,
            entityId,
            entity.profile.phones,
            now
          );
          const emails = stampContactMethods<EmailDraft, Email>(
            input.emails,
            entityId,
            entity.profile.emails,
            now
          );
          const addresses = stampContactMethods<AddressDraft, Address>(
            input.addresses,
            entityId,
            entity.profile.addresses,
            now
          );

          const before: Record<string, unknown> = {
            firstName: entity.profile.firstName,
            lastName: entity.profile.lastName,
            idNumber: entity.profile.idNumber,
            birthDateGregorian: entity.profile.birthDateGregorian,
            hebrewDateAdjustmentDays: entity.profile.hebrewDateAdjustmentDays,
            gender: entity.profile.gender,
            status: entity.status,
            tags: entity.tags,
            primaryPhone: getPrimaryPhone(entity.profile)?.number,
            primaryEmail: getPrimaryEmail(entity.profile)?.address,
            phones: entity.profile.phones.map(phone => ({
              number: phone.number,
              type: phone.type,
              isPrimary: phone.isPrimary,
              status: phone.status,
            })),
            emails: entity.profile.emails.map(email => ({
              address: email.address,
              type: email.type,
              isPrimary: email.isPrimary,
              status: email.status,
            })),
            addresses: entity.profile.addresses.map(address => ({
              city: address.city,
              street: address.street,
              isPrimary: address.isPrimary,
              status: address.status,
            })),
          };
          const after: Record<string, unknown> = {
            firstName: input.firstName,
            lastName: input.lastName,
            idNumber: input.idNumber,
            birthDateGregorian: input.birthDateGregorian,
            hebrewDateAdjustmentDays: input.hebrewDateAdjustmentDays,
            gender: input.gender,
            status: input.status,
            tags: input.tags,
            primaryPhone: phones.find(phone => phone.isPrimary)?.number,
            primaryEmail: emails.find(email => email.isPrimary)?.address,
            phones: phones.map(phone => ({
              number: phone.number,
              type: phone.type,
              isPrimary: phone.isPrimary,
              status: phone.status,
            })),
            emails: emails.map(email => ({
              address: email.address,
              type: email.type,
              isPrimary: email.isPrimary,
              status: email.status,
            })),
            addresses: addresses.map(address => ({
              city: address.city,
              street: address.street,
              isPrimary: address.isPrimary,
              status: address.status,
            })),
          };
          const changes = diffEntityFields(entityId, before, after, updatedByUserId, () =>
            createId('change')
          );
          if (changes.length > 0) {
            setFieldHistory(currentHistory => [...changes, ...currentHistory]);
          }

          updated = {
            ...entity,
            status: input.status,
            tags: input.tags,
            updatedAt: now,
            profile: {
              ...entity.profile,
              firstName: input.firstName,
              lastName: input.lastName,
              idNumber: input.idNumber,
              birthDateGregorian: input.birthDateGregorian,
              hebrewDateAdjustmentDays: input.hebrewDateAdjustmentDays,
              gender: input.gender,
              phones,
              emails,
              addresses,
            },
          };
          return updated;
        })
      );

      return updated;
    },
    []
  );

  const addRoleToEntity = useCallback(
    (
      entityId: string,
      role: EntityRoleId,
      roleDefinition: RoleDefinition | undefined,
      organizationId?: string
    ) => {
      let didAdd = false;
      setRoleAssignments(current => {
        if (!canAssignRole(entityId, role, current, roleDefinition)) {
          return current;
        }
        didAdd = true;
        return [
          ...current,
          {
            id: createId('role'),
            entityId,
            role,
            organizationId,
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        ];
      });
      if (didAdd) {
        setEntities(current =>
          current.map(entity =>
            entity.id === entityId ? { ...entity, updatedAt: new Date().toISOString() } : entity
          )
        );
      }
      return didAdd;
    },
    []
  );

  const removeRoleFromEntity = useCallback((entityId: string, roleAssignmentId: string) => {
    setRoleAssignments(current => current.filter(assignment => assignment.id !== roleAssignmentId));
    setEntities(current =>
      current.map(entity =>
        entity.id === entityId ? { ...entity, updatedAt: new Date().toISOString() } : entity
      )
    );
  }, []);

  const getNotesForEntity = useCallback(
    (entityId: string) => notes.filter(note => note.entityId === entityId),
    [notes]
  );

  /** Recomputes an entity's note-count summary; only a genuinely new note advances lastNoteAt. */
  const touchEntityNotesMetadata = useCallback(
    (entityId: string, count: number, newestNoteAt?: string) => {
      setEntities(current =>
        current.map(entity =>
          entity.id === entityId
            ? {
                ...entity,
                notesMetadata: {
                  count,
                  lastNoteAt: newestNoteAt ?? entity.notesMetadata.lastNoteAt,
                },
                updatedAt: new Date().toISOString(),
              }
            : entity
        )
      );
    },
    []
  );

  const addNote = useCallback(
    (entityId: string, content: string, authorUserId: string) => {
      if (!content.trim()) {
        return;
      }
      const now = new Date().toISOString();
      const newNote: Note = {
        id: createId('note'),
        entityId,
        content: content.trim(),
        createdByUserId: authorUserId,
        createdAt: now,
        updatedAt: now,
        revisions: [],
      };
      setNotes(current => {
        const next = [newNote, ...current];
        const activeCount = next.filter(
          note => note.entityId === entityId && !note.deletedAt
        ).length;
        touchEntityNotesMetadata(entityId, activeCount, now);
        return next;
      });
    },
    [touchEntityNotesMetadata]
  );

  const editNote = useCallback((noteId: string, content: string, editorUserId: string) => {
    if (!content.trim()) {
      return;
    }
    setNotes(current =>
      current.map(note => {
        if (note.id !== noteId) {
          return note;
        }
        const now = new Date().toISOString();
        return {
          ...note,
          content: content.trim(),
          updatedAt: now,
          updatedByUserId: editorUserId,
          revisions: [
            ...note.revisions,
            {
              id: createId('rev'),
              content: note.content,
              editedAt: note.updatedAt,
              editedByUserId: note.updatedByUserId ?? note.createdByUserId,
            },
          ],
        };
      })
    );
  }, []);

  const softDeleteNote = useCallback(
    (noteId: string, deleterUserId: string) => {
      setNotes(current => {
        const target = current.find(note => note.id === noteId);
        if (!target) {
          return current;
        }
        const now = new Date().toISOString();
        const next = current.map(note =>
          note.id === noteId ? { ...note, deletedAt: now, deletedByUserId: deleterUserId } : note
        );
        const activeCount = next.filter(
          note => note.entityId === target.entityId && !note.deletedAt
        ).length;
        touchEntityNotesMetadata(target.entityId, activeCount);
        return next;
      });
    },
    [touchEntityNotesMetadata]
  );

  const restoreNote = useCallback(
    (noteId: string) => {
      setNotes(current => {
        const target = current.find(note => note.id === noteId);
        if (!target) {
          return current;
        }
        const next = current.map(note =>
          note.id === noteId ? { ...note, deletedAt: null, deletedByUserId: null } : note
        );
        const activeCount = next.filter(
          note => note.entityId === target.entityId && !note.deletedAt
        ).length;
        touchEntityNotesMetadata(target.entityId, activeCount);
        return next;
      });
    },
    [touchEntityNotesMetadata]
  );

  const getHistoryForEntity = useCallback(
    (entityId: string) => fieldHistory.filter(change => change.entityId === entityId),
    [fieldHistory]
  );

  const recordDuplicateOverride = useCallback(
    (
      entityId: string,
      matchedEntityIds: string[],
      reasons: DuplicateMatchReason[],
      reason: string,
      decidedByUserId: string
    ) => {
      setDuplicateOverrides(current => [
        ...current,
        {
          id: createId('override'),
          entityId,
          matchedEntityIds,
          reasons,
          reason,
          decidedByUserId,
          decidedAt: new Date().toISOString(),
        },
      ]);
    },
    []
  );

  const value = useMemo<EntityContextValue>(
    () => ({
      entities,
      roleAssignments,
      notes,
      fieldHistory,
      duplicateOverrides,
      getEntityById,
      addPerson,
      updatePerson,
      addRoleToEntity,
      removeRoleFromEntity,
      getNotesForEntity,
      addNote,
      editNote,
      softDeleteNote,
      restoreNote,
      getHistoryForEntity,
      recordDuplicateOverride,
    }),
    [
      entities,
      roleAssignments,
      notes,
      fieldHistory,
      duplicateOverrides,
      getEntityById,
      addPerson,
      updatePerson,
      addRoleToEntity,
      removeRoleFromEntity,
      getNotesForEntity,
      addNote,
      editNote,
      softDeleteNote,
      restoreNote,
      getHistoryForEntity,
      recordDuplicateOverride,
    ]
  );

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntities(): EntityContextValue {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error('useEntities must be used within an EntityProvider');
  }
  return context;
}

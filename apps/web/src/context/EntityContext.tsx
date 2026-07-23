'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type Address,
  type AddressDraft,
  type DuplicateMatchReason,
  type DuplicateOverrideRecord,
  type Email,
  type EmailDraft,
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
import { useSession } from './SessionContext';
import {
  addNoteAction,
  assignRoleAction,
  createPersonAction,
  editNoteAction,
  listEntitiesAction,
  recordDuplicateOverrideAction,
  removeNoteAction,
  removeRoleAssignmentAction,
  restoreNoteAction,
  updatePersonAction,
  type LoadedEntityData,
} from '@/src/lib/actions/entityActions';

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type EntityContextValue = {
  /** Only person entities exist so far; this will widen to include organizations without changing the shape of this context. */
  entities: PersonEntity[];
  roleAssignments: RoleAssignment[];
  notes: Note[];
  duplicateOverrides: DuplicateOverrideRecord[];
  isLoading: boolean;
  getEntityById: (id: string) => PersonEntity | undefined;
  addPerson: (input: NewPersonInput) => Promise<PersonEntity | undefined>;
  updatePerson: (
    entityId: string,
    input: UpdatePersonInput,
    updatedByUserId: string
  ) => Promise<PersonEntity | undefined>;
  addRoleToEntity: (
    entityId: string,
    role: EntityRoleId,
    roleDefinition: RoleDefinition | undefined,
    organizationId?: string
  ) => Promise<boolean>;
  removeRoleFromEntity: (entityId: string, roleAssignmentId: string) => Promise<void>;
  getNotesForEntity: (entityId: string) => Note[];
  addNote: (entityId: string, content: string, authorUserId: string) => Promise<void>;
  editNote: (noteId: string, content: string, editorUserId: string) => Promise<void>;
  softDeleteNote: (noteId: string, deleterUserId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  recordDuplicateOverride: (
    entityId: string,
    matchedEntityIds: string[],
    reasons: DuplicateMatchReason[],
    reason: string,
    decidedByUserId: string
  ) => Promise<void>;
};

const EntityContext = createContext<EntityContextValue | undefined>(undefined);

/**
 * Real, persisted entity data (P013A - see docs/ROADMAP.md). Loads once per
 * selected organization via `listEntitiesAction` (a plain async function,
 * not a Route Handler - the approved server boundary for this platform);
 * every mutation calls its own Server Action (`entityActions.ts`), which
 * writes through `@nera/entity-engine`'s persistence repositories inside a
 * real `getOrganizationContext` transaction, records an audit row
 * atomically, and publishes the one approved event for that mutation (if
 * any). Local React state is then updated from the real, returned result -
 * this context is a client-side cache/orchestration layer over the Server
 * Actions, never an in-memory database of its own (the pre-P013A
 * `demoEntitiesData.ts` seed is no longer used anywhere).
 *
 * `fieldHistory`/`getHistoryForEntity` (previously exposed here) are removed:
 * P013A does not persist entity field-change history - see
 * PersonHistoryCard.tsx, now a placeholder.
 *
 * Two ways this provider gets its data (Owner-reviewed resolution to the
 * Server Component read blocker - see the implementation report):
 *
 * 1. Seeded (`initialEntities` etc. passed) - a Server Component (currently
 *    `contacts/page.tsx` and `contacts/[id]/page.tsx`) already fetched real
 *    data server-side and mounts a *nested* `EntityProvider` around its own
 *    subtree with that data as props; this instance never runs its own
 *    fetch. React context resolves to the nearest ancestor Provider, so
 *    every consumer inside that subtree (PeopleTable, PersonFormDialog,
 *    ...) needs zero changes to pick this up automatically.
 * 2. Unseeded (the single instance mounted in `(app)/layout.tsx`, wrapping
 *    the whole app shell) - falls back to the pre-existing client-side
 *    fetch via `listEntitiesAction` in a `useEffect`. This instance exists
 *    specifically for `AppShell`'s global header search, which needs an
 *    entities collection on every route, not just Contacts - a genuinely
 *    different, broader concern than the Contacts pages' own read, and one
 *    a single page-level Server Component fetch structurally cannot feed
 *    (it would need to run on every route, which defeats the purpose of a
 *    per-page fetch). Left on the existing mechanism deliberately, not
 *    silently - see the implementation report.
 */
export function EntityProvider({
  children,
  initialEntities,
  initialRoleAssignments,
  initialNotes,
}: {
  children: ReactNode;
  initialEntities?: PersonEntity[];
  initialRoleAssignments?: RoleAssignment[];
  initialNotes?: Note[];
}) {
  const { session } = useSession();
  const organizationId = session?.selectedOrganizationId;
  const isSeeded = initialEntities !== undefined;

  const [entities, setEntities] = useState<PersonEntity[]>(initialEntities ?? []);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>(
    initialRoleAssignments ?? []
  );
  const [notes, setNotes] = useState<Note[]>(initialNotes ?? []);
  const [duplicateOverrides, setDuplicateOverrides] = useState<DuplicateOverrideRecord[]>([]);
  const [isLoading, setIsLoading] = useState(!isSeeded);

  useEffect(() => {
    if (isSeeded || !organizationId) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listEntitiesAction(organizationId).then(result => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        const data: LoadedEntityData = result.data;
        setEntities(data.entities);
        setRoleAssignments(data.roleAssignments);
        setNotes(data.notes);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isSeeded, organizationId]);

  const getEntityById = useCallback(
    (id: string) => entities.find(entity => entity.id === id),
    [entities]
  );

  const addPerson = useCallback(
    async (input: NewPersonInput): Promise<PersonEntity | undefined> => {
      if (!organizationId) {
        return undefined;
      }
      const result = await createPersonAction(organizationId, input);
      if (!result.ok) {
        return undefined;
      }
      setEntities(current => [...current, result.data]);
      return result.data;
    },
    [organizationId]
  );

  const updatePerson = useCallback(
    async (
      entityId: string,
      input: UpdatePersonInput,
      _updatedByUserId: string
    ): Promise<PersonEntity | undefined> => {
      if (!organizationId) {
        return undefined;
      }
      const result = await updatePersonAction(organizationId, entityId, input);
      if (!result.ok) {
        return undefined;
      }
      setEntities(current =>
        current.map(entity => (entity.id === entityId ? result.data : entity))
      );
      return result.data;
    },
    [organizationId]
  );

  const addRoleToEntity = useCallback(
    async (
      entityId: string,
      role: EntityRoleId,
      _roleDefinition: RoleDefinition | undefined,
      orgIdOverride?: string
    ): Promise<boolean> => {
      const orgId = orgIdOverride ?? organizationId;
      if (!orgId) {
        return false;
      }
      const result = await assignRoleAction(orgId, entityId, role);
      if (!result.ok || !result.data) {
        return false;
      }
      setRoleAssignments(current => [...current, result.data as RoleAssignment]);
      return true;
    },
    [organizationId]
  );

  const removeRoleFromEntity = useCallback(
    async (entityId: string, roleAssignmentId: string) => {
      if (!organizationId) {
        return;
      }
      const result = await removeRoleAssignmentAction(organizationId, entityId, roleAssignmentId);
      if (result.ok) {
        setRoleAssignments(current => current.filter(a => a.id !== roleAssignmentId));
      }
    },
    [organizationId]
  );

  const getNotesForEntity = useCallback(
    (entityId: string) => notes.filter(note => note.entityId === entityId),
    [notes]
  );

  const addNote = useCallback(
    async (entityId: string, content: string, _authorUserId: string) => {
      if (!organizationId || !content.trim()) {
        return;
      }
      const result = await addNoteAction(organizationId, entityId, content.trim());
      if (result.ok) {
        setNotes(current => [result.data, ...current]);
      }
    },
    [organizationId]
  );

  const editNote = useCallback(
    async (noteId: string, content: string, _editorUserId: string) => {
      if (!organizationId || !content.trim()) {
        return;
      }
      const note = notes.find(n => n.id === noteId);
      if (!note) {
        return;
      }
      const result = await editNoteAction(organizationId, note.entityId, noteId, content.trim());
      if (result.ok) {
        setNotes(current => current.map(n => (n.id === noteId ? result.data : n)));
      }
    },
    [organizationId, notes]
  );

  const softDeleteNote = useCallback(
    async (noteId: string, _deleterUserId: string) => {
      if (!organizationId) {
        return;
      }
      const note = notes.find(n => n.id === noteId);
      if (!note) {
        return;
      }
      const result = await removeNoteAction(organizationId, note.entityId, noteId);
      if (result.ok) {
        setNotes(current =>
          current.map(n => (n.id === noteId ? { ...n, deletedAt: new Date().toISOString() } : n))
        );
      }
    },
    [organizationId, notes]
  );

  const restoreNote = useCallback(
    async (noteId: string) => {
      if (!organizationId) {
        return;
      }
      const note = notes.find(n => n.id === noteId);
      if (!note) {
        return;
      }
      const result = await restoreNoteAction(organizationId, note.entityId, noteId);
      if (result.ok) {
        setNotes(current => current.map(n => (n.id === noteId ? { ...n, deletedAt: null } : n)));
      }
    },
    [organizationId, notes]
  );

  const recordDuplicateOverride = useCallback(
    async (
      entityId: string,
      matchedEntityIds: string[],
      reasons: DuplicateMatchReason[],
      reason: string,
      decidedByUserId: string
    ) => {
      if (!organizationId) {
        return;
      }
      const result = await recordDuplicateOverrideAction(
        organizationId,
        entityId,
        matchedEntityIds,
        reasons,
        reason
      );
      if (result.ok) {
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
      }
    },
    [organizationId]
  );

  const value = useMemo<EntityContextValue>(
    () => ({
      entities,
      roleAssignments,
      notes,
      duplicateOverrides,
      isLoading,
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
      recordDuplicateOverride,
    }),
    [
      entities,
      roleAssignments,
      notes,
      duplicateOverrides,
      isLoading,
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

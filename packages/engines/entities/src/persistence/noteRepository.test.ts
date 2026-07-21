import { describe, expect, it, vi } from 'vitest';
import {
  createNoteRepository,
  type NoteRepositoryDbClient,
  type NoteRecord,
} from './noteRepository';

function makeNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: 'note-1',
    organizationId: 'org-1',
    entityId: 'entity-1',
    content: 'Original content',
    createdByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedByUserId: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    editedAt: null,
    deletedAt: null,
    deletedByUserId: null,
    ...overrides,
  };
}

function createFakeClient(
  findUniqueImpl?: () => Promise<NoteRecord | null>
): NoteRepositoryDbClient {
  return {
    note: {
      create: vi.fn(async ({ data }) => makeNote(data as Partial<NoteRecord>)),
      findUnique: vi.fn(findUniqueImpl ?? (async () => makeNote())),
      findMany: vi.fn(async () => [makeNote()]),
      update: vi.fn(async ({ data }) => makeNote(data as Partial<NoteRecord>)),
    },
  };
}

describe('createNoteRepository', () => {
  it('editNote sets editedAt - the lightweight signal replacing note_revisions (Owner-approved P013A design)', async () => {
    const client = createFakeClient();
    const repo = createNoteRepository(client);

    await repo.editNote({
      id: 'note-1',
      organizationId: 'org-1',
      content: 'Edited content',
      updatedByUserId: 'user-2',
    });

    expect(client.note.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: { content: 'Edited content', updatedByUserId: 'user-2', editedAt: expect.any(Date) },
    });
  });

  it('addNote never sets editedAt - only editNote does', async () => {
    const client = createFakeClient();
    const repo = createNoteRepository(client);

    await repo.addNote({
      organizationId: 'org-1',
      entityId: 'entity-1',
      content: 'New note',
      createdByUserId: 'user-1',
    });

    expect(client.note.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        entityId: 'entity-1',
        content: 'New note',
        createdByUserId: 'user-1',
      },
    });
  });

  it('editNote rejects a cross-organization edit before calling update', async () => {
    const client = createFakeClient(async () => makeNote({ organizationId: 'org-2' }));
    const repo = createNoteRepository(client);

    await expect(
      repo.editNote({
        id: 'note-1',
        organizationId: 'org-1',
        content: 'x',
        updatedByUserId: 'user-1',
      })
    ).rejects.toThrow(/does not belong to organization/);
    expect(client.note.update).not.toHaveBeenCalled();
  });

  it('removeNote is a soft delete (deletedAt/deletedByUserId), never a hard delete', async () => {
    const client = createFakeClient();
    const repo = createNoteRepository(client);

    await repo.removeNote('note-1', 'org-1', 'user-2');

    expect(client.note.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: { deletedAt: expect.any(Date), deletedByUserId: 'user-2' },
    });
  });

  it('restoreNote clears deletedAt/deletedByUserId', async () => {
    const client = createFakeClient();
    const repo = createNoteRepository(client);

    await repo.restoreNote('note-1', 'org-1');

    expect(client.note.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: { deletedAt: null, deletedByUserId: null },
    });
  });
});

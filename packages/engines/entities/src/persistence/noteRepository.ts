/**
 * Note persistence repository (P013A - see `docs/ROADMAP.md`).
 *
 * No `note_revisions` table (Owner-approved P013A design review): `audit_logs`
 * remains the only historical record of a note's prior content. `editedAt`
 * is a lightweight signal only, set whenever content changes after
 * creation, preserving the existing "edited" (נערך) UI indicator
 * (`isNoteEdited`) without a parallel history table.
 */

import { appPrisma, type Prisma } from '@nera/database';

export type NoteRecord = {
  id: string;
  organizationId: string;
  entityId: string;
  content: string;
  createdByUserId: string;
  createdAt: Date;
  updatedByUserId: string | null;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
};

export type NoteRepositoryDbClient = {
  note: {
    create(args: { data: Prisma.NoteUncheckedCreateInput }): Promise<NoteRecord>;
    findUnique(args: { where: { id: string } }): Promise<NoteRecord | null>;
    findMany(args: { where: { entityId: string } }): Promise<NoteRecord[]>;
    update(args: {
      where: { id: string };
      data: Prisma.NoteUncheckedUpdateInput;
    }): Promise<NoteRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`noteRepository: "${label}" is required and must be a non-empty string.`);
  }
}

async function assertOwnedByOrganization(
  client: NoteRepositoryDbClient,
  id: string,
  organizationId: string
): Promise<NoteRecord> {
  const note = await client.note.findUnique({ where: { id } });
  if (!note || note.organizationId !== organizationId) {
    throw new Error(
      `noteRepository: note "${id}" does not belong to organization "${organizationId}".`
    );
  }
  return note;
}

export type NoteRepository = {
  addNote(input: {
    organizationId: string;
    entityId: string;
    content: string;
    createdByUserId: string;
  }): Promise<NoteRecord>;
  listNotes(entityId: string): Promise<NoteRecord[]>;
  editNote(input: {
    id: string;
    organizationId: string;
    content: string;
    updatedByUserId: string;
  }): Promise<NoteRecord>;
  removeNote(id: string, organizationId: string, deletedByUserId: string): Promise<NoteRecord>;
  restoreNote(id: string, organizationId: string): Promise<NoteRecord>;
};

export function createNoteRepository(client: NoteRepositoryDbClient = appPrisma): NoteRepository {
  return {
    async addNote(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('entityId', input.entityId);
      assertRequiredString('content', input.content);
      assertRequiredString('createdByUserId', input.createdByUserId);

      return client.note.create({
        data: {
          organizationId: input.organizationId,
          entityId: input.entityId,
          content: input.content,
          createdByUserId: input.createdByUserId,
        },
      });
    },

    async listNotes(entityId) {
      assertRequiredString('entityId', entityId);
      return client.note.findMany({ where: { entityId } });
    },

    async editNote(input) {
      assertRequiredString('id', input.id);
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('content', input.content);
      assertRequiredString('updatedByUserId', input.updatedByUserId);
      await assertOwnedByOrganization(client, input.id, input.organizationId);

      return client.note.update({
        where: { id: input.id },
        data: {
          content: input.content,
          updatedByUserId: input.updatedByUserId,
          editedAt: new Date(),
        },
      });
    },

    async removeNote(id, organizationId, deletedByUserId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('deletedByUserId', deletedByUserId);
      await assertOwnedByOrganization(client, id, organizationId);

      return client.note.update({
        where: { id },
        data: { deletedAt: new Date(), deletedByUserId },
      });
    },

    async restoreNote(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(client, id, organizationId);

      return client.note.update({
        where: { id },
        data: { deletedAt: null, deletedByUserId: null },
      });
    },
  };
}

import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentLinkRepository,
  type DocumentLinkRepositoryDbClient,
  type DocumentLinkRecord,
} from './documentLinkRepository';
import type { NewDocumentLinkInput } from '../document';

function makeRecord(overrides: Partial<DocumentLinkRecord> = {}): DocumentLinkRecord {
  return {
    id: 'link-1',
    organizationId: 'org-1',
    documentId: 'doc-1',
    targetRecordType: 'purchase_order',
    targetRecordId: 'po-1',
    linkedByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    deletedByUserId: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<NewDocumentLinkInput> = {}): NewDocumentLinkInput {
  return {
    organizationId: 'org-1',
    documentId: 'doc-1',
    targetRecordType: 'purchase_order',
    targetRecordId: 'po-1',
    linkedByUserId: 'user-1',
    ...overrides,
  };
}

function createFakeClient(
  overrides: Partial<DocumentLinkRepositoryDbClient['documentLink']> = {}
): DocumentLinkRepositoryDbClient {
  return {
    documentLink: {
      create: vi.fn(async ({ data }) => makeRecord(data as Partial<DocumentLinkRecord>)),
      findMany: vi.fn(async () => [makeRecord()]),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => makeRecord()),
      update: vi.fn(async ({ data }) => makeRecord(data as Partial<DocumentLinkRecord>)),
      ...overrides,
    },
  };
}

describe('createDocumentLinkRepository', () => {
  it('creates a link scoped to the organization', async () => {
    const client = createFakeClient();
    const repo = createDocumentLinkRepository(client);

    await repo.createLink('org-1', makeInput());

    const call = (client.documentLink.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.organizationId).toBe('org-1');
    expect(call.data.targetRecordType).toBe('purchase_order');
  });

  it('rejects a duplicate identical link only among active (non-deleted) links', async () => {
    const client = createFakeClient({ findFirst: vi.fn(async () => makeRecord()) });
    const repo = createDocumentLinkRepository(client);

    await expect(repo.createLink('org-1', makeInput())).rejects.toThrow(/already linked/);
    expect(client.documentLink.create).not.toHaveBeenCalled();

    const findFirstCall = (client.documentLink.findFirst as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(findFirstCall.where.deletedAt).toBeNull();
  });

  it('allows re-linking the same document to the same target after a prior link was removed (no active duplicate found)', async () => {
    const client = createFakeClient({ findFirst: vi.fn(async () => null) });
    const repo = createDocumentLinkRepository(client);

    await repo.createLink('org-1', makeInput());

    expect(client.documentLink.create).toHaveBeenCalledTimes(1);
  });

  it('removeLink rejects a cross-organization link before calling update', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ organizationId: 'org-2' })),
    });
    const repo = createDocumentLinkRepository(client);

    await expect(repo.removeLink('link-1', 'org-1', 'user-1')).rejects.toThrow(
      /does not belong to organization/
    );
    expect(client.documentLink.update).not.toHaveBeenCalled();
  });

  it('removeLink rejects a link that is already removed', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ deletedAt: new Date('2026-01-01') })),
    });
    const repo = createDocumentLinkRepository(client);

    await expect(repo.removeLink('link-1', 'org-1', 'user-1')).rejects.toThrow(/already removed/);
    expect(client.documentLink.update).not.toHaveBeenCalled();
  });

  it('removeLink soft-deletes the link (sets deletedAt/deletedByUserId, never a real DELETE)', async () => {
    const client = createFakeClient();
    const repo = createDocumentLinkRepository(client);

    await repo.removeLink('link-1', 'org-1', 'user-2');

    expect(client.documentLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { deletedAt: expect.any(Date), deletedByUserId: 'user-2' },
    });
  });

  it('restoreLink rejects a link that is not currently removed', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ deletedAt: null })),
    });
    const repo = createDocumentLinkRepository(client);

    await expect(repo.restoreLink('link-1', 'org-1')).rejects.toThrow(/not removed/);
    expect(client.documentLink.update).not.toHaveBeenCalled();
  });

  it('restoreLink clears deletedAt/deletedByUserId for a removed link', async () => {
    const client = createFakeClient({
      findUnique: vi.fn(async () => makeRecord({ deletedAt: new Date('2026-01-01') })),
    });
    const repo = createDocumentLinkRepository(client);

    await repo.restoreLink('link-1', 'org-1');

    expect(client.documentLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { deletedAt: null, deletedByUserId: null },
    });
  });

  it('listLinksForDocument only queries active links (deletedAt: null)', async () => {
    const client = createFakeClient();
    const repo = createDocumentLinkRepository(client);

    await repo.listLinksForDocument('doc-1', 'org-1');

    expect(client.documentLink.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', documentId: 'doc-1', deletedAt: null },
    });
  });

  it('listLinksForDocument rejects a missing organizationId without touching the database', async () => {
    const client = createFakeClient();
    const repo = createDocumentLinkRepository(client);

    await expect(repo.listLinksForDocument('doc-1', '')).rejects.toThrow(/organizationId/);
    expect(client.documentLink.findMany).not.toHaveBeenCalled();
  });
});

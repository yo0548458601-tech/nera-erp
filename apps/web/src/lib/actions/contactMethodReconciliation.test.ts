import { describe, expect, it, vi } from 'vitest';
import { reconcileContactMethods } from './contactMethodReconciliation';

type FakeDraft = { id: string; isPrimary: boolean; number: string; deletedAt: string | null };

describe('reconcileContactMethods', () => {
  it('creates a new record for a draft id the database has never seen', async () => {
    const add = vi.fn(async () => undefined);
    const update = vi.fn(async () => undefined);
    const draft: FakeDraft = {
      id: 'client-generated-id',
      isPrimary: false,
      number: '050',
      deletedAt: null,
    };

    await reconcileContactMethods([draft], new Set(), 'entity-1', 'org-1', add, update);

    expect(add).toHaveBeenCalledWith({ ...draft, entityId: 'entity-1', organizationId: 'org-1' });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates an existing record in place for a draft id already known to the database', async () => {
    const add = vi.fn(async () => undefined);
    const update = vi.fn(async () => undefined);
    const draft: FakeDraft = {
      id: 'phone-1',
      isPrimary: true,
      number: '050-updated',
      deletedAt: null,
    };

    await reconcileContactMethods([draft], new Set(['phone-1']), 'entity-1', 'org-1', add, update);

    expect(update).toHaveBeenCalledWith('phone-1', 'org-1', draft);
    expect(add).not.toHaveBeenCalled();
  });

  it('passes a soft-deleted draft (deletedAt set) through to update, not a separate remove path', async () => {
    const add = vi.fn(async () => undefined);
    const update = vi.fn(async () => undefined);
    const draft: FakeDraft = {
      id: 'phone-1',
      isPrimary: false,
      number: '050',
      deletedAt: '2026-07-21T00:00:00.000Z',
    };

    await reconcileContactMethods([draft], new Set(['phone-1']), 'entity-1', 'org-1', add, update);

    expect(update).toHaveBeenCalledWith(
      'phone-1',
      'org-1',
      expect.objectContaining({ deletedAt: draft.deletedAt })
    );
  });

  it('handles a mix of new and existing drafts in one call, one add/update per draft', async () => {
    const add = vi.fn(async () => undefined);
    const update = vi.fn(async () => undefined);
    const existing: FakeDraft = { id: 'phone-1', isPrimary: true, number: '050', deletedAt: null };
    const fresh: FakeDraft = { id: 'client-new', isPrimary: false, number: '052', deletedAt: null };

    await reconcileContactMethods(
      [existing, fresh],
      new Set(['phone-1']),
      'entity-1',
      'org-1',
      add,
      update
    );

    expect(update).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the drafts array is empty, even if the entity has existing records', async () => {
    const add = vi.fn(async () => undefined);
    const update = vi.fn(async () => undefined);

    await reconcileContactMethods([], new Set(['phone-1']), 'entity-1', 'org-1', add, update);

    expect(add).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

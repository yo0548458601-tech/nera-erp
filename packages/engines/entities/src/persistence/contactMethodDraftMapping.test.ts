import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appPrisma, type Prisma } from '@nera/database';
import { createEntityRepository } from './entityRepository';
import {
  createContactMethodRepository,
  mapAddressDraftForCreate,
  mapAddressDraftForUpdate,
  mapEmailDraftForCreate,
  mapEmailDraftForUpdate,
  mapPhoneDraftForCreate,
  mapPhoneDraftForUpdate,
} from './contactMethodRepository';
import type { AddressDraft, EmailDraft, PhoneDraft } from '../contactMethods';

/**
 * Same minimal, local stand-in for `@nera/organization-engine`'s
 * `getOrganizationContext` used by `checkPermissionRls.test.ts` - this
 * package has no dependency on the organization engine (see
 * `package.json`), and this file's only purpose is proving the real
 * repository/Prisma contract, not exercising organization-engine.
 */
async function withOrganizationContext<T>(
  organizationId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return appPrisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
    return work(tx);
  });
}

function makePhoneDraft(overrides: Partial<PhoneDraft> = {}): PhoneDraft {
  return {
    id: randomUUID(),
    number: '0501234567',
    type: 'mobile',
    label: 'טלפון נייד',
    isPrimary: false,
    status: 'active',
    notes: undefined,
    order: 0,
    verified: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeEmailDraft(overrides: Partial<EmailDraft> = {}): EmailDraft {
  return {
    id: randomUUID(),
    address: 'demo@example.com',
    type: 'personal',
    label: '',
    isPrimary: false,
    status: 'active',
    notes: undefined,
    order: 0,
    verified: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeAddressDraft(overrides: Partial<AddressDraft> = {}): AddressDraft {
  return {
    id: randomUUID(),
    country: 'ישראל',
    city: 'תל אביב',
    street: 'רוטשילד',
    houseNumber: '1',
    type: 'home',
    isPrimary: false,
    status: 'active',
    notes: undefined,
    order: 0,
    verified: true,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Regression tests for a verified P013A production bug (see the
 * implementation report): the UI/domain model names the display-order field
 * `order`; the Prisma column is `sortOrder`. The reconciliation layer's
 * create path (`data => contactRepo.phones.add(data as never)` in
 * `entityActions.ts`) raw-spread the submitted draft straight into the
 * repository's `.add()`, forwarding `order` (which Prisma has never heard
 * of), the draft's client-generated `id`, and other UI-only shape. This
 * broke every "add a new phone/email/address while editing an existing
 * person" flow with a real, user-visible "שמירת הרשומה נכשלה" error - while
 * the *initial* person-creation path (a separate call site with its own,
 * correct explicit mapping) worked fine, which is exactly why the bug only
 * surfaced on edit, not create.
 *
 * These tests exercise the REAL `@prisma/client`, not a fake/mock model -
 * a fake client (as used by `contactMethodRepository.test.ts`) accepts any
 * shape and would never have caught this class of bug. Requires a real
 * PostgreSQL connection with the P013A migration applied (see
 * `packages/database/README.md`).
 */
describe('phone/email/address draft -> Prisma mapping (requires PostgreSQL)', () => {
  const ORG_ID = '00000000-0000-0000-0000-000000000000';
  let entityId: string;

  beforeAll(async () => {
    const entity = await withOrganizationContext(ORG_ID, async tx => {
      const entityRepo = createEntityRepository(tx);
      return entityRepo.createEntity({ organizationId: ORG_ID, entityType: 'person' });
    });
    entityId = entity.id;
  });

  afterAll(async () => {
    // Cleanup must run inside the same RLS context the fixture was created
    // in - verified directly, P014: `entities`/`phones`/`emails`/`addresses`
    // are FORCE-RLS tables, so an unscoped delete via the raw admin `prisma`
    // client (no `app.current_organization_id` set) matches no rows at all
    // (RLS hides them from the query, not merely from writing them), and
    // Prisma reports "No record was found for a delete" - not a permission
    // error, but the row is genuinely invisible to that unscoped query.
    await withOrganizationContext(ORG_ID, async tx => {
      await tx.phone.deleteMany({ where: { entityId } });
      await tx.email.deleteMany({ where: { entityId } });
      await tx.address.deleteMany({ where: { entityId } });
      await tx.entity.delete({ where: { id: entityId } });
    });
  });

  describe('the exact reported bug - raw-spreading a draft into .add() is rejected by real Prisma', () => {
    it('phone: throws "Unknown argument `order`", not a generic failure', async () => {
      await withOrganizationContext(ORG_ID, async tx => {
        const contactRepo = createContactMethodRepository(tx);
        const draft = makePhoneDraft();

        await expect(
          contactRepo.phones.add({ ...draft, entityId, organizationId: ORG_ID } as never)
        ).rejects.toThrow(/Unknown argument `order`/);
      });
    });

    it('email: throws "Unknown argument `order`", not a generic failure', async () => {
      await withOrganizationContext(ORG_ID, async tx => {
        const contactRepo = createContactMethodRepository(tx);
        const draft = makeEmailDraft();

        await expect(
          contactRepo.emails.add({ ...draft, entityId, organizationId: ORG_ID } as never)
        ).rejects.toThrow(/Unknown argument `order`/);
      });
    });

    it('address: throws "Unknown argument `order`", not a generic failure', async () => {
      await withOrganizationContext(ORG_ID, async tx => {
        const contactRepo = createContactMethodRepository(tx);
        const draft = makeAddressDraft();

        await expect(
          contactRepo.addresses.add({ ...draft, entityId, organizationId: ORG_ID } as never)
        ).rejects.toThrow(/Unknown argument `order`/);
      });
    });
  });

  describe('the fix - mapped create/update round-trips real repository-compatible payloads', () => {
    it('phone: create persists sortOrder/verified, then update persists changes including soft-delete', async () => {
      await withOrganizationContext(ORG_ID, async tx => {
        const contactRepo = createContactMethodRepository(tx);
        const draft = makePhoneDraft({ order: 3, verified: false });

        const created = await contactRepo.phones.add({
          entityId,
          organizationId: ORG_ID,
          ...mapPhoneDraftForCreate(draft),
        });
        expect(created.sortOrder).toBe(3);
        expect(created.number).toBe(draft.number);
        expect(created.id).not.toBe(draft.id);

        const updatedDraft = makePhoneDraft({
          ...draft,
          id: created.id,
          number: '0509999999',
          order: 7,
          deletedAt: '2026-07-23T00:00:00.000Z',
          deletedByUserId: undefined,
        });
        const updated = await contactRepo.phones.update(
          created.id,
          ORG_ID,
          mapPhoneDraftForUpdate(updatedDraft)
        );
        expect(updated.sortOrder).toBe(7);
        expect(updated.number).toBe('0509999999');
        expect(updated.deletedAt).toEqual(new Date('2026-07-23T00:00:00.000Z'));
      });
    });

    it('email: create persists sortOrder, then update persists changes', async () => {
      await withOrganizationContext(ORG_ID, async tx => {
        const contactRepo = createContactMethodRepository(tx);
        const draft = makeEmailDraft({ order: 2 });

        const created = await contactRepo.emails.add({
          entityId,
          organizationId: ORG_ID,
          ...mapEmailDraftForCreate(draft),
        });
        expect(created.sortOrder).toBe(2);
        expect(created.address).toBe(draft.address);

        const updated = await contactRepo.emails.update(
          created.id,
          ORG_ID,
          mapEmailDraftForUpdate(
            makeEmailDraft({ ...draft, id: created.id, address: 'updated@example.com', order: 5 })
          )
        );
        expect(updated.sortOrder).toBe(5);
        expect(updated.address).toBe('updated@example.com');
      });
    });

    it('address: create persists sortOrder/verified, then update persists changes', async () => {
      await withOrganizationContext(ORG_ID, async tx => {
        const contactRepo = createContactMethodRepository(tx);
        const draft = makeAddressDraft({ order: 1, verified: true });

        const created = await contactRepo.addresses.add({
          entityId,
          organizationId: ORG_ID,
          ...mapAddressDraftForCreate(draft),
        });
        expect(created.sortOrder).toBe(1);
        expect(created.verified).toBe(true);
        expect(created.street).toBe(draft.street);

        const updated = await contactRepo.addresses.update(
          created.id,
          ORG_ID,
          mapAddressDraftForUpdate(
            makeAddressDraft({ ...draft, id: created.id, street: 'הרצל', order: 4 })
          )
        );
        expect(updated.sortOrder).toBe(4);
        expect(updated.street).toBe('הרצל');
      });
    });
  });

  describe('UI-only/unknown properties are never forwarded to Prisma', () => {
    it('a bogus, never-defined UI-only property on the draft is dropped by the mapper, not forwarded', () => {
      const draftWithBogusField = {
        ...makePhoneDraft(),
        uiOnlyHighlighted: true,
        clientTempKey: 'temp-123',
      } as PhoneDraft & { uiOnlyHighlighted: boolean; clientTempKey: string };

      const mapped = mapPhoneDraftForCreate(draftWithBogusField);

      expect(mapped).not.toHaveProperty('uiOnlyHighlighted');
      expect(mapped).not.toHaveProperty('clientTempKey');
      expect(mapped).not.toHaveProperty('id');
      expect(mapped).not.toHaveProperty('order');
      expect(mapped).toHaveProperty('sortOrder', 0);
    });

    it('forwarding that same bogus payload straight to real Prisma (the old bug) is rejected', async () => {
      await withOrganizationContext(ORG_ID, async tx => {
        const contactRepo = createContactMethodRepository(tx);
        const draftWithBogusField = {
          ...makePhoneDraft(),
          uiOnlyHighlighted: true,
        };

        await expect(
          contactRepo.phones.add({
            ...draftWithBogusField,
            entityId,
            organizationId: ORG_ID,
          } as never)
        ).rejects.toThrow(/Unknown argument/);
      });
    });
  });
});

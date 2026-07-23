/**
 * Phone / Email / Address persistence repository (P013A - see
 * `docs/ROADMAP.md`). Each type is its own table (see schema.prisma) but
 * shares an identical operation shape: add / update / deactivate / remove /
 * restore. "At most one primary active record per entity" is enforced by a
 * partial unique index at the database level (see the P013A migration) -
 * this repository additionally clears any existing primary before setting a
 * new one, so the constraint is never hit by ordinary use; the index itself
 * remains the real guarantee (defense in depth, not application-only).
 */

import {
  appPrisma,
  type AddressType,
  type ContactMethodStatus,
  type EmailType,
  type Prisma,
  type PhoneType,
} from '@nera/database';
import type { AddressDraft, EmailDraft, PhoneDraft } from '../contactMethods';

type ContactRecordBase = {
  id: string;
  organizationId: string;
  entityId: string;
  isPrimary: boolean;
  status: ContactMethodStatus;
  notes: string | null;
  sortOrder: number;
  verified: boolean;
  verifiedAt: Date | null;
  verifiedByUserId: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PhoneRecord = ContactRecordBase & { number: string; type: PhoneType; label: string };
export type EmailRecord = ContactRecordBase & { address: string; type: EmailType; label: string };
export type AddressRecord = ContactRecordBase & {
  country: string | null;
  city: string | null;
  cityProviderId: string | null;
  street: string | null;
  streetProviderId: string | null;
  houseNumber: string | null;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  postalCode: string | null;
  type: AddressType;
};

/**
 * Explicit, type-checked draft -> Prisma input mapping (P013A - verified bug
 * fix: the UI/domain model names this field `order`; the Prisma column is
 * `sortOrder`. Raw-spreading a *Draft object straight into `.add()` throws
 * "Unknown argument `order`" on create - Prisma rejects the unrecognized
 * key outright - and would have silently dropped `order`/`sortOrder` on
 * update too (the draft's `id` and other UI-only shape would also have been
 * forwarded). Every field below is named explicitly against the real
 * `Prisma.*UncheckedCreateInput`/`*UncheckedUpdateInput` types, so the
 * compiler - not a runtime Prisma error - catches the next rename. `id` is
 * deliberately never forwarded on create: a new draft's id is a
 * client-generated placeholder used only to match the row up in local
 * component state before save; the server always lets Prisma generate the
 * real id, and the caller re-fetches the persisted record (with its real
 * id) once the mutation completes.
 */
export function mapPhoneDraftForCreate(
  draft: PhoneDraft
): Omit<Prisma.PhoneUncheckedCreateInput, 'id' | 'organizationId' | 'entityId'> {
  return {
    number: draft.number,
    type: draft.type,
    label: draft.label,
    isPrimary: draft.isPrimary,
    status: draft.status,
    notes: draft.notes ?? null,
    sortOrder: draft.order,
    verified: draft.verified,
    verifiedAt: draft.verifiedAt ?? null,
    verifiedByUserId: draft.verifiedByUserId ?? null,
  };
}

export function mapPhoneDraftForUpdate(draft: PhoneDraft): {
  number: string;
  type: PhoneType;
  label: string;
  isPrimary: boolean;
  status: ContactMethodStatus;
  notes: string | null;
  sortOrder: number;
  verified: boolean;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  deletedAt: string | null;
  deletedByUserId: string | null;
} {
  return {
    number: draft.number,
    type: draft.type,
    label: draft.label,
    isPrimary: draft.isPrimary,
    status: draft.status,
    notes: draft.notes ?? null,
    sortOrder: draft.order,
    verified: draft.verified,
    verifiedAt: draft.verifiedAt ?? null,
    verifiedByUserId: draft.verifiedByUserId ?? null,
    deletedAt: draft.deletedAt ?? null,
    deletedByUserId: draft.deletedByUserId ?? null,
  };
}

export function mapEmailDraftForCreate(
  draft: EmailDraft
): Omit<Prisma.EmailUncheckedCreateInput, 'id' | 'organizationId' | 'entityId'> {
  return {
    address: draft.address,
    type: draft.type,
    label: draft.label,
    isPrimary: draft.isPrimary,
    status: draft.status,
    notes: draft.notes ?? null,
    sortOrder: draft.order,
    verified: draft.verified,
    verifiedAt: draft.verifiedAt ?? null,
    verifiedByUserId: draft.verifiedByUserId ?? null,
  };
}

export function mapEmailDraftForUpdate(draft: EmailDraft): {
  address: string;
  type: EmailType;
  label: string;
  isPrimary: boolean;
  status: ContactMethodStatus;
  notes: string | null;
  sortOrder: number;
  verified: boolean;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  deletedAt: string | null;
  deletedByUserId: string | null;
} {
  return {
    address: draft.address,
    type: draft.type,
    label: draft.label,
    isPrimary: draft.isPrimary,
    status: draft.status,
    notes: draft.notes ?? null,
    sortOrder: draft.order,
    verified: draft.verified,
    verifiedAt: draft.verifiedAt ?? null,
    verifiedByUserId: draft.verifiedByUserId ?? null,
    deletedAt: draft.deletedAt ?? null,
    deletedByUserId: draft.deletedByUserId ?? null,
  };
}

export function mapAddressDraftForCreate(
  draft: AddressDraft
): Omit<Prisma.AddressUncheckedCreateInput, 'id' | 'organizationId' | 'entityId'> {
  return {
    country: draft.country ?? null,
    city: draft.city ?? null,
    cityProviderId: draft.cityProviderId ?? null,
    street: draft.street ?? null,
    streetProviderId: draft.streetProviderId ?? null,
    houseNumber: draft.houseNumber ?? null,
    entrance: draft.entrance ?? null,
    floor: draft.floor ?? null,
    apartment: draft.apartment ?? null,
    postalCode: draft.postalCode ?? null,
    type: draft.type,
    isPrimary: draft.isPrimary,
    status: draft.status,
    notes: draft.notes ?? null,
    sortOrder: draft.order,
    verified: draft.verified,
    verifiedAt: draft.verifiedAt ?? null,
    verifiedByUserId: draft.verifiedByUserId ?? null,
  };
}

export function mapAddressDraftForUpdate(draft: AddressDraft): {
  country: string | null;
  city: string | null;
  cityProviderId: string | null;
  street: string | null;
  streetProviderId: string | null;
  houseNumber: string | null;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  postalCode: string | null;
  type: AddressType;
  isPrimary: boolean;
  status: ContactMethodStatus;
  notes: string | null;
  sortOrder: number;
  verified: boolean;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  deletedAt: string | null;
  deletedByUserId: string | null;
} {
  return {
    country: draft.country ?? null,
    city: draft.city ?? null,
    cityProviderId: draft.cityProviderId ?? null,
    street: draft.street ?? null,
    streetProviderId: draft.streetProviderId ?? null,
    houseNumber: draft.houseNumber ?? null,
    entrance: draft.entrance ?? null,
    floor: draft.floor ?? null,
    apartment: draft.apartment ?? null,
    postalCode: draft.postalCode ?? null,
    type: draft.type,
    isPrimary: draft.isPrimary,
    status: draft.status,
    notes: draft.notes ?? null,
    sortOrder: draft.order,
    verified: draft.verified,
    verifiedAt: draft.verifiedAt ?? null,
    verifiedByUserId: draft.verifiedByUserId ?? null,
    deletedAt: draft.deletedAt ?? null,
    deletedByUserId: draft.deletedByUserId ?? null,
  };
}

type ContactModelClient<TRecord, TCreateInput, TUpdateInput> = {
  create(args: { data: TCreateInput }): Promise<TRecord>;
  findUnique(args: { where: { id: string } }): Promise<TRecord | null>;
  findMany(args: { where: { entityId: string } }): Promise<TRecord[]>;
  update(args: { where: { id: string }; data: TUpdateInput }): Promise<TRecord>;
  updateMany(args: {
    where: { entityId: string; isPrimary: true; id?: { not: string } };
    data: { isPrimary: false };
  }): Promise<{ count: number }>;
};

export type ContactMethodRepositoryDbClient = {
  phone: ContactModelClient<
    PhoneRecord,
    Prisma.PhoneUncheckedCreateInput,
    Prisma.PhoneUncheckedUpdateInput
  >;
  email: ContactModelClient<
    EmailRecord,
    Prisma.EmailUncheckedCreateInput,
    Prisma.EmailUncheckedUpdateInput
  >;
  address: ContactModelClient<
    AddressRecord,
    Prisma.AddressUncheckedCreateInput,
    Prisma.AddressUncheckedUpdateInput
  >;
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `contactMethodRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

async function assertOwnedByOrganization<T extends { organizationId: string } | null>(
  find: () => Promise<T>,
  id: string,
  organizationId: string
): Promise<NonNullable<T>> {
  const record = await find();
  if (!record || record.organizationId !== organizationId) {
    throw new Error(
      `contactMethodRepository: record "${id}" does not belong to organization "${organizationId}".`
    );
  }
  return record as NonNullable<T>;
}

function makeContactMethodRepository<TRecord extends ContactRecordBase, TCreateInput, TUpdateInput>(
  model: ContactModelClient<TRecord, TCreateInput, TUpdateInput>
) {
  async function clearOtherPrimaries(entityId: string, exceptId?: string): Promise<void> {
    await model.updateMany({
      where: { entityId, isPrimary: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isPrimary: false },
    });
  }

  return {
    async add(
      data: TCreateInput & { entityId: string; organizationId: string; isPrimary?: boolean }
    ) {
      assertRequiredString('entityId', data.entityId);
      assertRequiredString('organizationId', data.organizationId);

      if (data.isPrimary) {
        await clearOtherPrimaries(data.entityId);
      }
      return model.create({ data: data as TCreateInput });
    },

    async list(entityId: string) {
      assertRequiredString('entityId', entityId);
      return model.findMany({ where: { entityId } });
    },

    async update(id: string, organizationId: string, data: TUpdateInput & { isPrimary?: boolean }) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      const existing = await assertOwnedByOrganization(
        () => model.findUnique({ where: { id } }),
        id,
        organizationId
      );

      if (data.isPrimary) {
        await clearOtherPrimaries(existing.entityId, id);
      }
      return model.update({ where: { id }, data: data as TUpdateInput });
    },

    async deactivate(id: string, organizationId: string) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(
        () => model.findUnique({ where: { id } }),
        id,
        organizationId
      );

      return model.update({ where: { id }, data: { status: 'inactive' } as TUpdateInput });
    },

    async reactivate(id: string, organizationId: string) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(
        () => model.findUnique({ where: { id } }),
        id,
        organizationId
      );

      return model.update({ where: { id }, data: { status: 'active' } as TUpdateInput });
    },

    async remove(id: string, organizationId: string, deletedByUserId: string) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      assertRequiredString('deletedByUserId', deletedByUserId);
      await assertOwnedByOrganization(
        () => model.findUnique({ where: { id } }),
        id,
        organizationId
      );

      return model.update({
        where: { id },
        data: { deletedAt: new Date(), deletedByUserId } as TUpdateInput,
      });
    },

    async restore(id: string, organizationId: string) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);
      await assertOwnedByOrganization(
        () => model.findUnique({ where: { id } }),
        id,
        organizationId
      );

      return model.update({
        where: { id },
        data: { deletedAt: null, deletedByUserId: null } as TUpdateInput,
      });
    },
  };
}

export type ContactMethodRepository = {
  phones: ReturnType<
    typeof makeContactMethodRepository<
      PhoneRecord,
      Prisma.PhoneUncheckedCreateInput,
      Prisma.PhoneUncheckedUpdateInput
    >
  >;
  emails: ReturnType<
    typeof makeContactMethodRepository<
      EmailRecord,
      Prisma.EmailUncheckedCreateInput,
      Prisma.EmailUncheckedUpdateInput
    >
  >;
  addresses: ReturnType<
    typeof makeContactMethodRepository<
      AddressRecord,
      Prisma.AddressUncheckedCreateInput,
      Prisma.AddressUncheckedUpdateInput
    >
  >;
};

export function createContactMethodRepository(
  client: ContactMethodRepositoryDbClient = appPrisma
): ContactMethodRepository {
  return {
    phones: makeContactMethodRepository(client.phone),
    emails: makeContactMethodRepository(client.email),
    addresses: makeContactMethodRepository(client.address),
  };
}

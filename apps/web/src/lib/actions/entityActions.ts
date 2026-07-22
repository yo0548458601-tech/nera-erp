'use server';

/**
 * Server Actions for the Contacts feature (P013A - see docs/ROADMAP.md).
 * Every mutation: validate input -> checkPermission -> getOrganizationContext
 * (real transaction, same tx used for the repository call and the audit
 * write) -> repository call -> recordAudit -> publish the one approved event
 * (if any) after commit -> revalidatePath. No Route Handlers anywhere in
 * P013A - reads are plain async functions called from Server Components;
 * writes are these Server Actions, also callable directly from client event
 * handlers (e.g. the global header search) without needing a REST endpoint.
 *
 * Not real authentication: `assignedByUserId`/`createdByUserId`/etc. and the
 * checkPermission actor all resolve to the fixed demo identity
 * (`demoIdentity.ts`), matching real, seeded database rows.
 */

import { revalidatePath } from 'next/cache';
import { createOrganizationEngine } from '@nera/organization-engine';
import { createAuditEngine } from '@nera/audit-engine';
import { eventBus } from '@nera/event-bus-engine';
import {
  createContactMethodRepository,
  createDuplicateOverrideRepository,
  createEntityRepository,
  createNoteRepository,
  createPersonProfileRepository,
  createRoleAssignmentRepository,
  entityRoleRegistry,
  findRoleDefinition,
  type Address,
  type AddressDraft,
  type DuplicateMatchReason,
  type Email,
  type EmailDraft,
  type EntityRoleId,
  type NewPersonInput,
  type Note,
  type Phone,
  type PhoneDraft,
  type PersonEntity,
  type RoleAssignment,
  type UpdatePersonInput,
} from '@nera/entity-engine';
import { DEMO_MEMBERSHIP_ID, DEMO_USER_PROFILE_ID } from '@/src/lib/auth/demoIdentity';
import { reconcileContactMethods } from './contactMethodReconciliation';
import { requirePermission } from './requirePermission';

const { getOrganizationContext } = createOrganizationEngine();

export type ActionResult<T> = { ok: true; data: T } | { ok: false; reason: string };

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function fromIsoOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ? new Date(value) : null;
}

function toPhone(record: {
  id: string;
  entityId: string;
  number: string;
  type: Phone['type'];
  label: string;
  isPrimary: boolean;
  status: Phone['status'];
  notes: string | null;
  sortOrder: number;
  verified: boolean;
  verifiedAt: Date | null;
  verifiedByUserId: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Phone {
  return {
    id: record.id,
    entityId: record.entityId,
    number: record.number,
    type: record.type,
    label: record.label,
    isPrimary: record.isPrimary,
    status: record.status,
    notes: record.notes ?? undefined,
    order: record.sortOrder,
    verified: record.verified,
    verifiedAt: toIso(record.verifiedAt),
    verifiedByUserId: record.verifiedByUserId ?? undefined,
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    deletedByUserId: record.deletedByUserId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toEmail(record: {
  id: string;
  entityId: string;
  address: string;
  type: Email['type'];
  label: string;
  isPrimary: boolean;
  status: Email['status'];
  notes: string | null;
  sortOrder: number;
  verified: boolean;
  verifiedAt: Date | null;
  verifiedByUserId: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Email {
  return {
    id: record.id,
    entityId: record.entityId,
    address: record.address,
    type: record.type,
    label: record.label,
    isPrimary: record.isPrimary,
    status: record.status,
    notes: record.notes ?? undefined,
    order: record.sortOrder,
    verified: record.verified,
    verifiedAt: toIso(record.verifiedAt),
    verifiedByUserId: record.verifiedByUserId ?? undefined,
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    deletedByUserId: record.deletedByUserId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toAddress(record: {
  id: string;
  entityId: string;
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
  type: Address['type'];
  isPrimary: boolean;
  status: Address['status'];
  notes: string | null;
  sortOrder: number;
  verified: boolean;
  verifiedAt: Date | null;
  verifiedByUserId: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Address {
  return {
    id: record.id,
    entityId: record.entityId,
    country: record.country ?? undefined,
    city: record.city ?? undefined,
    cityProviderId: record.cityProviderId ?? undefined,
    street: record.street ?? undefined,
    streetProviderId: record.streetProviderId ?? undefined,
    houseNumber: record.houseNumber ?? undefined,
    entrance: record.entrance ?? undefined,
    floor: record.floor ?? undefined,
    apartment: record.apartment ?? undefined,
    postalCode: record.postalCode ?? undefined,
    type: record.type,
    isPrimary: record.isPrimary,
    status: record.status,
    notes: record.notes ?? undefined,
    order: record.sortOrder,
    verified: record.verified,
    verifiedAt: toIso(record.verifiedAt),
    verifiedByUserId: record.verifiedByUserId ?? undefined,
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    deletedByUserId: record.deletedByUserId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toNoteDomain(record: {
  id: string;
  entityId: string;
  content: string;
  createdByUserId: string;
  createdAt: Date;
  updatedByUserId: string | null;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
}): Note {
  return {
    id: record.id,
    entityId: record.entityId,
    content: record.content,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedByUserId: record.updatedByUserId ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
    editedAt: record.editedAt ? record.editedAt.toISOString() : null,
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    deletedByUserId: record.deletedByUserId,
    revisions: [],
  };
}

function toRoleAssignmentDomain(record: {
  id: string;
  organizationId: string;
  entityId: string;
  role: string;
  status: RoleAssignment['status'];
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  moduleProfileRef: string | null;
  createdAt: Date;
  removedAt: Date | null;
}): RoleAssignment {
  return {
    id: record.id,
    entityId: record.entityId,
    role: record.role,
    organizationId: record.organizationId,
    status: record.status,
    startDate: record.startDate ? record.startDate.toISOString().slice(0, 10) : undefined,
    endDate: record.endDate ? record.endDate.toISOString().slice(0, 10) : undefined,
    notes: record.notes ?? undefined,
    moduleProfileRef: record.moduleProfileRef ?? undefined,
    createdAt: record.createdAt.toISOString(),
  };
}

export type LoadedEntityData = {
  entities: PersonEntity[];
  roleAssignments: RoleAssignment[];
  notes: Note[];
};

/** Assembles the full Contacts dataset for one organization - the initial "read" this app calls on load. Not a Route Handler; a plain async function called directly (see EntityContext.tsx). */
export async function listEntitiesAction(
  organizationId: string
): Promise<ActionResult<LoadedEntityData>> {
  const denyReason = await requirePermission(organizationId, 'entities.view_sensitive');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  const data = await getOrganizationContext({ organizationId }, async tx => {
    const entityRepo = createEntityRepository(tx);
    const profileRepo = createPersonProfileRepository(tx);
    const contactRepo = createContactMethodRepository(tx);
    const noteRepo = createNoteRepository(tx);
    const roleRepo = createRoleAssignmentRepository(tx);

    const entityRows = await entityRepo.listEntities(organizationId);
    const entities: PersonEntity[] = [];
    let allRoleAssignments: RoleAssignment[] = [];
    let allNotes: Note[] = [];

    for (const entityRow of entityRows) {
      const profile = await profileRepo.getPersonProfile(entityRow.id, organizationId);
      if (!profile) {
        continue;
      }
      const [phones, emails, addresses, notes, roleAssignments, metadata] = await Promise.all([
        contactRepo.phones.list(entityRow.id),
        contactRepo.emails.list(entityRow.id),
        contactRepo.addresses.list(entityRow.id),
        noteRepo.listNotes(entityRow.id),
        roleRepo.listRoleAssignments(entityRow.id),
        entityRepo.getNotesMetadata(entityRow.id),
      ]);

      entities.push({
        id: entityRow.id,
        neraId: entityRow.neraId,
        entityType: 'person',
        status: entityRow.status,
        tenantId: entityRow.organizationId,
        tags: entityRow.tags,
        notesMetadata: {
          count: metadata.count,
          lastNoteAt: metadata.lastNoteAt ? metadata.lastNoteAt.toISOString() : undefined,
        },
        createdAt: entityRow.createdAt.toISOString(),
        updatedAt: entityRow.updatedAt.toISOString(),
        deletedAt: entityRow.deletedAt ? entityRow.deletedAt.toISOString() : null,
        profile: {
          entityId: entityRow.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          idNumber: profile.idNumber ?? undefined,
          birthDateGregorian: profile.birthDateGregorian
            ? profile.birthDateGregorian.toISOString().slice(0, 10)
            : undefined,
          hebrewDateAdjustmentDays: profile.hebrewDateAdjustmentDays as -1 | 0 | 1,
          gender: profile.gender,
          profileImageUrl: profile.profileImageUrl ?? undefined,
          phones: phones.map(toPhone),
          emails: emails.map(toEmail),
          addresses: addresses.map(toAddress),
        },
      });

      allRoleAssignments = allRoleAssignments.concat(
        roleAssignments.filter(a => a.removedAt === null).map(toRoleAssignmentDomain)
      );
      allNotes = allNotes.concat(notes.map(toNoteDomain));
    }

    return { entities, roleAssignments: allRoleAssignments, notes: allNotes };
  });

  return { ok: true, data };
}

export async function createPersonAction(
  organizationId: string,
  input: NewPersonInput
): Promise<ActionResult<PersonEntity>> {
  const denyReason = await requirePermission(organizationId, 'entities.edit');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  const created = await getOrganizationContext({ organizationId }, async tx => {
    const entityRepo = createEntityRepository(tx);
    const profileRepo = createPersonProfileRepository(tx);
    const contactRepo = createContactMethodRepository(tx);
    const roleRepo = createRoleAssignmentRepository(tx);
    const audit = createAuditEngine(tx);

    const entity = await entityRepo.createEntity({
      organizationId,
      entityType: 'person',
      tags: input.tags,
    });
    const profile = await profileRepo.createPersonProfile({
      entityId: entity.id,
      organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      idNumber: input.idNumber,
      birthDateGregorian: input.birthDateGregorian ? new Date(input.birthDateGregorian) : undefined,
      hebrewDateAdjustmentDays: input.hebrewDateAdjustmentDays,
      gender: input.gender,
    });

    const phones = await Promise.all(
      input.phones.map(draft =>
        contactRepo.phones.add({
          entityId: entity.id,
          organizationId,
          number: draft.number,
          type: draft.type,
          label: draft.label,
          isPrimary: draft.isPrimary,
          notes: draft.notes,
          sortOrder: draft.order,
        } as never)
      )
    );
    const emails = await Promise.all(
      input.emails.map(draft =>
        contactRepo.emails.add({
          entityId: entity.id,
          organizationId,
          address: draft.address,
          type: draft.type,
          label: draft.label,
          isPrimary: draft.isPrimary,
          notes: draft.notes,
          sortOrder: draft.order,
        } as never)
      )
    );
    const addresses = await Promise.all(
      input.addresses.map(draft =>
        contactRepo.addresses.add({
          entityId: entity.id,
          organizationId,
          type: draft.type,
          isPrimary: draft.isPrimary,
          notes: draft.notes,
          sortOrder: draft.order,
          country: draft.country,
          city: draft.city,
          street: draft.street,
          houseNumber: draft.houseNumber,
          entrance: draft.entrance,
          floor: draft.floor,
          apartment: draft.apartment,
          postalCode: draft.postalCode,
        } as never)
      )
    );

    const roleAssignments: RoleAssignment[] = [];
    for (const role of input.roles) {
      const roleDefinition = findRoleDefinition(entityRoleRegistry, role);
      const assignment = await roleRepo.assignRole({
        organizationId,
        entityId: entity.id,
        role,
        assignedByUserId: DEMO_USER_PROFILE_ID,
        roleDefinition,
      });
      roleAssignments.push(toRoleAssignmentDomain(assignment));
    }

    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'entity.created',
      entityType: 'entity',
      entityId: entity.id,
      newValues: { firstName: input.firstName, lastName: input.lastName },
    });

    const personEntity: PersonEntity = {
      id: entity.id,
      neraId: entity.neraId,
      entityType: 'person',
      status: entity.status,
      tenantId: entity.organizationId,
      tags: entity.tags,
      notesMetadata: { count: 0 },
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      profile: {
        entityId: entity.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        idNumber: profile.idNumber ?? undefined,
        birthDateGregorian: profile.birthDateGregorian
          ? profile.birthDateGregorian.toISOString().slice(0, 10)
          : undefined,
        hebrewDateAdjustmentDays: profile.hebrewDateAdjustmentDays as -1 | 0 | 1,
        gender: profile.gender,
        phones: phones.map(toPhone),
        emails: emails.map(toEmail),
        addresses: addresses.map(toAddress),
      },
    };

    return { personEntity, roleAssignments };
  });

  await eventBus.publish({
    eventType: 'EntityCreated',
    organizationId,
    actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
    payload: { entityId: created.personEntity.id },
  });

  revalidatePath('/contacts');
  return { ok: true, data: created.personEntity };
}

export async function updatePersonAction(
  organizationId: string,
  entityId: string,
  input: UpdatePersonInput
): Promise<ActionResult<PersonEntity>> {
  const denyReason = await requirePermission(organizationId, 'entities.edit');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  const result = await getOrganizationContext({ organizationId }, async tx => {
    const entityRepo = createEntityRepository(tx);
    const profileRepo = createPersonProfileRepository(tx);
    const contactRepo = createContactMethodRepository(tx);
    const audit = createAuditEngine(tx);

    const entity = await entityRepo.updateEntity({
      id: entityId,
      organizationId,
      status: input.status,
      tags: input.tags,
    });
    const profile = await profileRepo.updatePersonProfile({
      entityId,
      organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      idNumber: input.idNumber,
      birthDateGregorian: input.birthDateGregorian ? new Date(input.birthDateGregorian) : undefined,
      hebrewDateAdjustmentDays: input.hebrewDateAdjustmentDays,
      gender: input.gender,
    });

    const [existingPhones, existingEmails, existingAddresses] = await Promise.all([
      contactRepo.phones.list(entityId),
      contactRepo.emails.list(entityId),
      contactRepo.addresses.list(entityId),
    ]);

    await reconcileContactMethods(
      input.phones,
      new Set(existingPhones.map(p => p.id)),
      entityId,
      organizationId,
      data => contactRepo.phones.add(data as never),
      (id, orgId, data) =>
        contactRepo.phones.update(id, orgId, {
          number: data.number,
          type: data.type,
          label: data.label,
          isPrimary: data.isPrimary,
          status: data.status,
          notes: data.notes,
          sortOrder: data.order,
          deletedAt: fromIsoOrNull(data.deletedAt),
          deletedByUserId: data.deletedByUserId,
        } as never)
    );

    await reconcileContactMethods(
      input.emails,
      new Set(existingEmails.map(e => e.id)),
      entityId,
      organizationId,
      data => contactRepo.emails.add(data as never),
      (id, orgId, data) =>
        contactRepo.emails.update(id, orgId, {
          address: data.address,
          type: data.type,
          label: data.label,
          isPrimary: data.isPrimary,
          status: data.status,
          notes: data.notes,
          sortOrder: data.order,
          deletedAt: fromIsoOrNull(data.deletedAt),
          deletedByUserId: data.deletedByUserId,
        } as never)
    );

    await reconcileContactMethods(
      input.addresses,
      new Set(existingAddresses.map(a => a.id)),
      entityId,
      organizationId,
      data => contactRepo.addresses.add(data as never),
      (id, orgId, data) =>
        contactRepo.addresses.update(id, orgId, {
          type: data.type,
          isPrimary: data.isPrimary,
          status: data.status,
          notes: data.notes,
          sortOrder: data.order,
          country: data.country,
          city: data.city,
          cityProviderId: data.cityProviderId,
          street: data.street,
          streetProviderId: data.streetProviderId,
          houseNumber: data.houseNumber,
          entrance: data.entrance,
          floor: data.floor,
          apartment: data.apartment,
          postalCode: data.postalCode,
          deletedAt: fromIsoOrNull(data.deletedAt),
          deletedByUserId: data.deletedByUserId,
        } as never)
    );

    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'entity.updated',
      entityType: 'entity',
      entityId,
      newValues: { firstName: input.firstName, lastName: input.lastName, status: input.status },
    });

    return { entity, profile };
  });

  await eventBus.publish({
    eventType: 'EntityUpdated',
    organizationId,
    actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
    payload: { entityId },
  });

  revalidatePath(`/contacts/${entityId}`);
  revalidatePath('/contacts');

  return listEntityByIdAction(organizationId, entityId);
}

export async function archivePersonAction(
  organizationId: string,
  entityId: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'entities.archive');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const entityRepo = createEntityRepository(tx);
    const audit = createAuditEngine(tx);
    await entityRepo.archiveEntity(entityId, organizationId);
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'entity.archived',
      entityType: 'entity',
      entityId,
    });
  });

  await eventBus.publish({
    eventType: 'EntityArchived',
    organizationId,
    actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
    payload: { entityId },
  });

  revalidatePath('/contacts');
  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: null };
}

export async function restorePersonAction(
  organizationId: string,
  entityId: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'entities.archive');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const entityRepo = createEntityRepository(tx);
    const audit = createAuditEngine(tx);
    await entityRepo.restoreEntity(entityId, organizationId);
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'entity.restored',
      entityType: 'entity',
      entityId,
    });
  });

  revalidatePath('/contacts');
  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: null };
}

async function listEntityByIdAction(
  organizationId: string,
  entityId: string
): Promise<ActionResult<PersonEntity>> {
  const all = await listEntitiesAction(organizationId);
  if (!all.ok) {
    return all;
  }
  const found = all.data.entities.find(entity => entity.id === entityId);
  if (!found) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, data: found };
}

type ContactMethodKind = 'phone' | 'email' | 'address';

export async function addContactMethodAction(
  organizationId: string,
  entityId: string,
  kind: ContactMethodKind,
  draft: PhoneDraft | EmailDraft | AddressDraft
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'contact_methods.edit');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const contactRepo = createContactMethodRepository(tx);
    const audit = createAuditEngine(tx);
    const base = { entityId, organizationId, isPrimary: draft.isPrimary, sortOrder: draft.order };

    if (kind === 'phone') {
      const phone = draft as PhoneDraft;
      await contactRepo.phones.add({
        ...base,
        number: phone.number,
        type: phone.type,
        label: phone.label,
        notes: phone.notes,
      } as never);
    } else if (kind === 'email') {
      const email = draft as EmailDraft;
      await contactRepo.emails.add({
        ...base,
        address: email.address,
        type: email.type,
        label: email.label,
        notes: email.notes,
      } as never);
    } else {
      const address = draft as AddressDraft;
      await contactRepo.addresses.add({
        ...base,
        type: address.type,
        notes: address.notes,
        country: address.country,
        city: address.city,
        street: address.street,
        houseNumber: address.houseNumber,
        entrance: address.entrance,
        floor: address.floor,
        apartment: address.apartment,
        postalCode: address.postalCode,
      } as never);
    }

    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: `contact_method.added`,
      entityType: kind,
      entityId,
    });
  });

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: null };
}

export async function removeContactMethodAction(
  organizationId: string,
  entityId: string,
  kind: ContactMethodKind,
  id: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'contact_methods.remove');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const contactRepo = createContactMethodRepository(tx);
    const audit = createAuditEngine(tx);
    const repo =
      kind === 'phone'
        ? contactRepo.phones
        : kind === 'email'
          ? contactRepo.emails
          : contactRepo.addresses;
    await repo.remove(id, organizationId, DEMO_USER_PROFILE_ID);
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'contact_method.removed',
      entityType: kind,
      entityId: id,
    });
  });

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: null };
}

export async function addNoteAction(
  organizationId: string,
  entityId: string,
  content: string
): Promise<ActionResult<Note>> {
  const denyReason = await requirePermission(organizationId, 'notes.edit');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  const note = await getOrganizationContext({ organizationId }, async tx => {
    const noteRepo = createNoteRepository(tx);
    const audit = createAuditEngine(tx);
    const created = await noteRepo.addNote({
      organizationId,
      entityId,
      content,
      createdByUserId: DEMO_USER_PROFILE_ID,
    });
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'note.added',
      entityType: 'note',
      entityId: created.id,
      newValues: { content },
    });
    return created;
  });

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: toNoteDomain(note) };
}

export async function editNoteAction(
  organizationId: string,
  entityId: string,
  noteId: string,
  content: string
): Promise<ActionResult<Note>> {
  const denyReason = await requirePermission(organizationId, 'notes.edit');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  const note = await getOrganizationContext({ organizationId }, async tx => {
    const noteRepo = createNoteRepository(tx);
    const audit = createAuditEngine(tx);
    const before = await noteRepo
      .listNotes(entityId)
      .then(notes => notes.find(n => n.id === noteId));
    const updated = await noteRepo.editNote({
      id: noteId,
      organizationId,
      content,
      updatedByUserId: DEMO_USER_PROFILE_ID,
    });
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'note.edited',
      entityType: 'note',
      entityId: noteId,
      oldValues: before ? { content: before.content } : undefined,
      newValues: { content },
    });
    return updated;
  });

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: toNoteDomain(note) };
}

export async function removeNoteAction(
  organizationId: string,
  entityId: string,
  noteId: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'notes.delete');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const noteRepo = createNoteRepository(tx);
    const audit = createAuditEngine(tx);
    await noteRepo.removeNote(noteId, organizationId, DEMO_USER_PROFILE_ID);
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'note.removed',
      entityType: 'note',
      entityId: noteId,
    });
  });

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: null };
}

export async function restoreNoteAction(
  organizationId: string,
  entityId: string,
  noteId: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'notes.restore');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const noteRepo = createNoteRepository(tx);
    const audit = createAuditEngine(tx);
    await noteRepo.restoreNote(noteId, organizationId);
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'note.restored',
      entityType: 'note',
      entityId: noteId,
    });
  });

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: null };
}

export async function assignRoleAction(
  organizationId: string,
  entityId: string,
  role: EntityRoleId
): Promise<ActionResult<RoleAssignment | null>> {
  const denyReason = await requirePermission(organizationId, 'entities.roles.manage');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  try {
    const assignment = await getOrganizationContext({ organizationId }, async tx => {
      const roleRepo = createRoleAssignmentRepository(tx);
      const audit = createAuditEngine(tx);
      const roleDefinition = findRoleDefinition(entityRoleRegistry, role);
      const created = await roleRepo.assignRole({
        organizationId,
        entityId,
        role,
        assignedByUserId: DEMO_USER_PROFILE_ID,
        roleDefinition,
      });
      await audit.recordAudit({
        organizationId,
        actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
        action: 'role_assignment.added',
        entityType: 'role_assignment',
        entityId: created.id,
        newValues: { role },
      });
      return created;
    });

    await eventBus.publish({
      eventType: 'EntityRoleAssigned',
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      payload: { entityId, role },
    });

    revalidatePath(`/contacts/${entityId}`);
    return { ok: true, data: toRoleAssignmentDomain(assignment) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

export async function removeRoleAssignmentAction(
  organizationId: string,
  entityId: string,
  assignmentId: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'entities.roles.manage');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const roleRepo = createRoleAssignmentRepository(tx);
    const audit = createAuditEngine(tx);
    await roleRepo.removeRoleAssignment(assignmentId, organizationId);
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'role_assignment.removed',
      entityType: 'role_assignment',
      entityId: assignmentId,
    });
  });

  revalidatePath(`/contacts/${entityId}`);
  return { ok: true, data: null };
}

export async function recordDuplicateOverrideAction(
  organizationId: string,
  entityId: string,
  matchedEntityIds: string[],
  matchReasons: DuplicateMatchReason[],
  overrideReason: string
): Promise<ActionResult<null>> {
  const denyReason = await requirePermission(organizationId, 'entities.duplicate_override');
  if (denyReason) {
    return { ok: false, reason: denyReason };
  }

  await getOrganizationContext({ organizationId }, async tx => {
    const overrideRepo = createDuplicateOverrideRepository(tx);
    const audit = createAuditEngine(tx);
    const created = await overrideRepo.recordDuplicateOverride({
      organizationId,
      entityId,
      matchedEntityIds,
      matchReasons,
      overrideReason,
      decidedByUserId: DEMO_USER_PROFILE_ID,
    });
    await audit.recordAudit({
      organizationId,
      actor: { userProfileId: DEMO_USER_PROFILE_ID, membershipId: DEMO_MEMBERSHIP_ID },
      action: 'duplicate_override.recorded',
      entityType: 'duplicate_override_record',
      entityId: created.id,
      newValues: { matchedEntityIds, matchReasons, overrideReason },
    });
  });

  return { ok: true, data: null };
}

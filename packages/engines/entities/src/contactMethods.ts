/**
 * Shared contact-method shapes, used by both PersonProfile and
 * OrganizationProfile so phones/emails/addresses are modeled identically
 * regardless of which kind of entity they belong to. An entity may hold
 * any number of each - these are never collapsed to a single field; a
 * "primary" flag marks the one used by default in short displays, while
 * the full arrays remain the source of truth everywhere else (see
 * getPrimaryPhone/getPrimaryEmail/getPrimaryAddress below).
 */
export type ContactMethodStatus = 'active' | 'inactive';

/**
 * Soft-delete marker shared by every contact method, matching the same
 * convention already used for notes (see notes.ts): "removed" is never a
 * hard delete - a removed record keeps deletedAt/deletedByUserId and can
 * be restored (see ListFieldEditor.tsx's restore action). This is a
 * different axis from ContactMethodStatus: `status` is the user-facing
 * active/inactive toggle ("הפוך ללא פעילה" / "הפעל מחדש" - the record
 * still shows up, just not as a default/primary contact method), while
 * deletedAt is "הסר" (removed from the visible list entirely, but
 * recoverable, never gone).
 */
export type SoftDeletable = {
  deletedAt?: string | null;
  deletedByUserId?: string;
};

/**
 * Shared verification metadata for every contact method (phone, email,
 * address). `verified` predates this type on Address specifically (it
 * already meant "resolved via AddressProvider autocomplete, not manually
 * typed" - see AddressListEditor) - that meaning is preserved and now
 * simply one of two ways `verified` can become true, the other being an
 * explicit future human-verification workflow (e.g. a staff member
 * confirming a phone number is reachable) that would set `verifiedAt`/
 * `verifiedByUserId` alongside it. No UI for that workflow exists yet
 * this sprint - only the data model, prepared once so a later sprint adds
 * a verify action rather than a schema change.
 */
export type ContactVerification = {
  verified: boolean;
  verifiedAt?: string;
  verifiedByUserId?: string;
};

export type PhoneType = 'mobile' | 'home' | 'work' | 'fax' | 'other';

export type Phone = SoftDeletable &
  ContactVerification & {
    id: string;
    entityId: string;
    number: string;
    type: PhoneType;
    /** Free-text Hebrew label the user can set (e.g. "טלפון המשרד הראשי"), separate from `type`. */
    label: string;
    isPrimary: boolean;
    status: ContactMethodStatus;
    notes?: string;
    /** Display ordering within the entity's phone list, ascending. */
    order: number;
    createdAt: string;
    updatedAt: string;
  };

export type EmailType = 'personal' | 'work' | 'billing' | 'notifications' | 'other';

export type Email = SoftDeletable &
  ContactVerification & {
    id: string;
    entityId: string;
    address: string;
    type: EmailType;
    /** Free-text Hebrew label the user can set, separate from `type`. */
    label: string;
    isPrimary: boolean;
    status: ContactMethodStatus;
    notes?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
  };

export type AddressType = 'home' | 'work' | 'billing' | 'mailing' | 'registered' | 'other';

/**
 * A structured address - never collapsed to a single free-text string.
 * `cityProviderId`/`streetProviderId` are optional metadata pointing back
 * to whichever AddressProvider (see addressProvider.ts) supplied the
 * locality/street the user selected via autocomplete; they are absent for
 * a manually-typed, unverified address. See ContactVerification for what
 * `verified`/`verifiedAt`/`verifiedByUserId` mean here specifically.
 */
export type Address = SoftDeletable &
  ContactVerification & {
    id: string;
    entityId: string;
    country?: string;
    city?: string;
    cityProviderId?: string;
    street?: string;
    streetProviderId?: string;
    houseNumber?: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    postalCode?: string;
    type: AddressType;
    isPrimary: boolean;
    status: ContactMethodStatus;
    notes?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
  };

/**
 * A form-editable draft of a contact method: everything except `entityId`
 * (assigned at save time by whichever entity owns it) and the timestamps
 * (stamped by the context - createdAt is preserved for a pre-existing id,
 * updatedAt is always refreshed). Create and edit forms build up
 * PhoneDraft[]/EmailDraft[]/AddressDraft[] identically - a "new" draft
 * simply has a freshly client-generated `id` that has no matching existing
 * record yet, so the same shape and the same save path serve both flows.
 */
export type PhoneDraft = Omit<Phone, 'entityId' | 'createdAt' | 'updatedAt'>;
export type EmailDraft = Omit<Email, 'entityId' | 'createdAt' | 'updatedAt'>;
export type AddressDraft = Omit<Address, 'entityId' | 'createdAt' | 'updatedAt'>;

function isSelectable<T extends { isPrimary: boolean; status: ContactMethodStatus; deletedAt?: string | null }>(record: T): boolean {
  return record.status === 'active' && !record.deletedAt;
}

/** Active, non-removed records only - the set shown by default in any list/editor. */
export function excludeDeleted<T extends SoftDeletable>(records: T[]): T[] {
  return records.filter((record) => !record.deletedAt);
}

/** Removed (soft-deleted) records only - shown behind a "הצג פריטים שהוסרו" toggle, each restorable. */
export function onlyDeleted<T extends SoftDeletable>(records: T[]): T[] {
  return records.filter((record) => Boolean(record.deletedAt));
}

export function getPrimaryPhone(record: { phones: Phone[] }): Phone | undefined {
  const active = record.phones.filter(isSelectable);
  return active.find((phone) => phone.isPrimary) ?? active[0];
}

export function getPrimaryEmail(record: { emails: Email[] }): Email | undefined {
  const active = record.emails.filter(isSelectable);
  return active.find((email) => email.isPrimary) ?? active[0];
}

export function getPrimaryAddress(record: { addresses: Address[] }): Address | undefined {
  const active = record.addresses.filter(isSelectable);
  return active.find((address) => address.isPrimary) ?? active[0];
}

/**
 * Combines an address's structured fields into one display string, in
 * conventional Israeli order (street + house number, entrance/floor/
 * apartment, city, postal code, country). Used for compact displays and as
 * the default XLSX "כתובת מלאה" column - the structured fields themselves
 * remain the source of truth, this is purely a rendering convenience.
 */
export function formatAddress(address: Partial<Address>): string {
  const streetLine = [address.street, address.houseNumber].filter(Boolean).join(' ');
  const unitParts = [
    address.entrance ? `כניסה ${address.entrance}` : undefined,
    address.floor ? `קומה ${address.floor}` : undefined,
    address.apartment ? `דירה ${address.apartment}` : undefined,
  ].filter(Boolean);
  const unitLine = unitParts.join(', ');

  const segments = [streetLine, unitLine, address.city, address.postalCode, address.country].filter(
    (segment): segment is string => Boolean(segment && segment.trim()),
  );

  return segments.join(', ');
}

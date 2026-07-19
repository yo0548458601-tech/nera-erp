import { type Entity, type EntityStatus } from './entity';
import {
  type Address,
  type AddressDraft,
  type Email,
  type EmailDraft,
  type Phone,
  type PhoneDraft,
} from './contactMethods';
import { type EntityRoleId } from './roles';

export type PersonGender = 'male' | 'female' | 'unspecified';

/**
 * Person-specific fields, kept off the core Entity record and never placed
 * on an organization entity. Associated with an Entity of entityType
 * 'person' via entityId (1:1).
 */
export type PersonProfile = {
  entityId: string;
  firstName: string;
  lastName: string;
  idNumber?: string;
  /**
   * The authoritative, stored birth date - always Gregorian. The Hebrew
   * equivalent is never stored separately; it is always computed from this
   * field (plus hebrewDateAdjustmentDays) via the Calendar Engine, so the
   * two representations can never drift out of sync or conflict.
   */
  birthDateGregorian?: string;
  /**
   * A deliberate, explicit -1/0/+1 day adjustment applied before Hebrew
   * conversion, for the case where only a Gregorian date (no time of day)
   * is known and the true Hebrew day is uncertain near sunset. Defaults to
   * 0. This is never a free-text Hebrew date override - see
   * apps/web hebrewBirthDate.ts, the only place this is consumed.
   */
  hebrewDateAdjustmentDays: -1 | 0 | 1;
  gender: PersonGender;
  phones: Phone[];
  emails: Email[];
  addresses: Address[];
  /** Placeholder for a future uploaded profile image. */
  profileImageUrl?: string;
};

/** An Entity narrowed to entityType 'person', with its profile attached. */
export type PersonEntity = Entity & {
  entityType: 'person';
  profile: PersonProfile;
};

export function getPersonFullName(profile: Pick<PersonProfile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}

/**
 * The input for creating or editing a person entity. Both flows submit the
 * FULL phones/emails/addresses arrays (as PhoneDraft/EmailDraft/
 * AddressDraft - see contactMethods.ts): the create/edit form is itself
 * the complete source of truth for these lists while open, so nothing is
 * ever silently dropped by only representing "the primary one" here - a
 * concern that mattered under the old primary-only input shape and no
 * longer applies now that the form manages every entry explicitly.
 */
export type NewPersonInput = {
  firstName: string;
  lastName: string;
  idNumber?: string;
  birthDateGregorian?: string;
  hebrewDateAdjustmentDays: -1 | 0 | 1;
  gender: PersonGender;
  phones: PhoneDraft[];
  emails: EmailDraft[];
  addresses: AddressDraft[];
  tags: string[];
  roles: EntityRoleId[];
};

export type UpdatePersonInput = {
  firstName: string;
  lastName: string;
  idNumber?: string;
  birthDateGregorian?: string;
  hebrewDateAdjustmentDays: -1 | 0 | 1;
  gender: PersonGender;
  status: EntityStatus;
  tags: string[];
  phones: PhoneDraft[];
  emails: EmailDraft[];
  addresses: AddressDraft[];
};

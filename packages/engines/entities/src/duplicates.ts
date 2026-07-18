import { type AnyEntity, getEntityDisplayName, isPersonEntity } from './unified';

export type DuplicateMatchReason = 'idNumber' | 'registrationNumber' | 'phone' | 'email' | 'similarName';

export type DuplicateMatch = {
  entity: AnyEntity;
  reasons: DuplicateMatchReason[];
  /**
   * True only for an exact unique-identifier conflict (ID number /
   * registration number) - the high-severity case. This never means "the
   * system decided these are the same entity" and it never triggers an
   * automatic merge. It means the conflict cannot be silently ignored: the
   * UI must require a deliberate, permission-checked action from the user
   * (open the existing record, keep separate with a documented reason via
   * entities.duplicate_override, or cancel) before a new entity is created.
   */
  isBlocking: boolean;
};

export type DuplicateCandidate = {
  idNumber?: string;
  registrationNumber?: string;
  displayName?: string;
  phones: Array<{ number: string }>;
  emails: Array<{ address: string }>;
};

function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Finds existing entities that may be duplicates of the given candidate:
 * for people, ID number / phone / email / similar name; for organizations,
 * registration number / phone / email / similar legal or display name.
 *
 * Entities are never merged automatically here. Only an exact ID-number or
 * registration-number conflict is `isBlocking` (per the platform's rule
 * that duplicates are warned about, not auto-resolved, unless a unique
 * identifier truly conflicts) - phone/email/name matches are informational
 * only and never prevent creation. A future merge flow (see merge.ts) is
 * where a user can deliberately compare and combine records.
 */
export function detectPotentialDuplicates(
  candidate: DuplicateCandidate,
  existingEntities: AnyEntity[],
  excludeEntityId?: string,
): DuplicateMatch[] {
  const candidatePhones = new Set(candidate.phones.map((phone) => normalizePhone(phone.number)).filter(Boolean));
  const candidateEmails = new Set(candidate.emails.map((email) => normalizeEmail(email.address)).filter(Boolean));
  const candidateIdNumber = candidate.idNumber?.trim();
  const candidateRegistrationNumber = candidate.registrationNumber?.trim();
  const candidateName = candidate.displayName ? normalizeName(candidate.displayName) : undefined;

  const matches: DuplicateMatch[] = [];

  for (const entity of existingEntities) {
    if (entity.id === excludeEntityId) {
      continue;
    }

    const reasons: DuplicateMatchReason[] = [];
    let isBlocking = false;

    if (isPersonEntity(entity)) {
      if (candidateIdNumber && entity.profile.idNumber && candidateIdNumber === entity.profile.idNumber.trim()) {
        reasons.push('idNumber');
        isBlocking = true;
      }
    } else if (
      candidateRegistrationNumber &&
      entity.profile.registrationNumber &&
      candidateRegistrationNumber === entity.profile.registrationNumber.trim()
    ) {
      reasons.push('registrationNumber');
      isBlocking = true;
    }

    if (candidatePhones.size > 0 && entity.profile.phones.some((phone) => candidatePhones.has(normalizePhone(phone.number)))) {
      reasons.push('phone');
    }
    if (candidateEmails.size > 0 && entity.profile.emails.some((email) => candidateEmails.has(normalizeEmail(email.address)))) {
      reasons.push('email');
    }
    if (candidateName && normalizeName(getEntityDisplayName(entity)) === candidateName) {
      reasons.push('similarName');
    }

    if (reasons.length > 0) {
      matches.push({ entity, reasons, isBlocking });
    }
  }

  return matches;
}

export function hasBlockingDuplicate(matches: DuplicateMatch[]): boolean {
  return matches.some((match) => match.isBlocking);
}

/**
 * Records a deliberate decision to keep two (or more) records separate
 * despite a detected duplicate conflict, for future audit and for
 * suppressing the same warning again where appropriate. Creating this
 * record is itself the resolution - it is never created automatically.
 */
export type DuplicateOverrideRecord = {
  id: string;
  /** The entity that was created or edited despite the conflict. */
  entityId: string;
  /** The existing entities the conflict was matched against. */
  matchedEntityIds: string[];
  reasons: DuplicateMatchReason[];
  /** Required explanation from the user performing the override. */
  reason: string;
  decidedByUserId: string;
  decidedAt: string;
};

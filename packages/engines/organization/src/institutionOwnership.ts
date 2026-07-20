/**
 * Institution ownership validation (`ENGINE_MAP.md` Section 3; ADR-002
 * Decision item 5; P012 - see `docs/ROADMAP.md`).
 *
 * `assertInstitutionBelongsToOrganization()` is the concrete implementation
 * of ADR-002's rule: "`institution_id` must never be trusted without also
 * validating organization ownership." Every failure mode is a distinct,
 * explainable `InstitutionOwnershipError` reason - never a bare generic
 * error - matching the "safe deny with a reason" shape P011's
 * `checkPermission` already established.
 *
 * A soft-deleted institution (`deletedAt` set) is treated as not belonging
 * to any organization for this check's purposes - this is a direct extension
 * of the Constitution's soft-delete semantics (NERA_CONSTITUTION.md Section
 * 7.4), not something ADR-002 names explicitly, in the same spirit as the
 * equivalent judgment call already made for `checkPermission`'s
 * inactive-membership handling in P011.
 */

import { prisma } from '@nera/database';

export type InstitutionOwnershipReason =
  'unknown-institution' | 'organization-mismatch' | 'institution-deleted';

export class InstitutionOwnershipError extends Error {
  public readonly reason: InstitutionOwnershipReason;
  public readonly institutionId: string;
  public readonly organizationId: string;

  constructor(reason: InstitutionOwnershipReason, institutionId: string, organizationId: string) {
    super(
      `Institution "${institutionId}" does not belong to organization "${organizationId}" (${reason}).`
    );
    this.name = 'InstitutionOwnershipError';
    this.reason = reason;
    this.institutionId = institutionId;
    this.organizationId = organizationId;
  }
}

/** The minimal, structural slice of a Prisma-compatible client this function needs. */
export type InstitutionOwnershipDbClient = {
  institution: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      organizationId: string;
      deletedAt: Date | null;
    } | null>;
  };
};

function assertValidIds(institutionId: string, organizationId: string): void {
  const requiredStrings: Array<[string, unknown]> = [
    ['institutionId', institutionId],
    ['organizationId', organizationId],
  ];

  for (const [label, value] of requiredStrings) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(
        `assertInstitutionBelongsToOrganization: "${label}" is required and must be a non-empty string.`
      );
    }
  }
}

/**
 * Factory, matching `createGetOrganizationContext`'s convention. Defaults to
 * the real `@nera/database` client; construction never queries the database.
 */
export function createAssertInstitutionBelongsToOrganization(
  client: InstitutionOwnershipDbClient = prisma
) {
  return async function assertInstitutionBelongsToOrganization(
    institutionId: string,
    organizationId: string
  ): Promise<void> {
    assertValidIds(institutionId, organizationId);

    const institution = await client.institution.findUnique({ where: { id: institutionId } });

    if (!institution) {
      throw new InstitutionOwnershipError('unknown-institution', institutionId, organizationId);
    }
    if (institution.organizationId !== organizationId) {
      throw new InstitutionOwnershipError('organization-mismatch', institutionId, organizationId);
    }
    if (institution.deletedAt !== null) {
      throw new InstitutionOwnershipError('institution-deleted', institutionId, organizationId);
    }
  };
}

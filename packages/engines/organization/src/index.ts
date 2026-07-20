import { prisma } from '@nera/database';
import {
  createGetOrganizationContext,
  type OrganizationContext,
  type OrganizationContextDbClient,
  type OrganizationScopedWork,
} from './organizationContext.js';
import {
  createAssertInstitutionBelongsToOrganization,
  type InstitutionOwnershipDbClient,
} from './institutionOwnership.js';

export {
  createGetOrganizationContext,
  type OrganizationContext,
  type OrganizationContextDbClient,
  type OrganizationScopedWork,
} from './organizationContext.js';
export {
  createAssertInstitutionBelongsToOrganization,
  InstitutionOwnershipError,
  type InstitutionOwnershipDbClient,
  type InstitutionOwnershipReason,
} from './institutionOwnership.js';

export type OrganizationEngineDbClient = OrganizationContextDbClient & InstitutionOwnershipDbClient;

export type OrganizationEngine = {
  getOrganizationContext<T>(
    context: OrganizationContext,
    work: OrganizationScopedWork<T>
  ): Promise<T>;
  assertInstitutionBelongsToOrganization(
    institutionId: string,
    organizationId: string
  ): Promise<void>;
};

/**
 * Factory, matching `createAuditEngine`/`createAuthorizationEngine`. Defaults
 * to the real, Prisma-backed `@nera/database` client; construction never
 * queries the database.
 */
export function createOrganizationEngine(
  client: OrganizationEngineDbClient = prisma
): OrganizationEngine {
  return {
    getOrganizationContext: createGetOrganizationContext(client),
    assertInstitutionBelongsToOrganization: createAssertInstitutionBelongsToOrganization(client),
  };
}

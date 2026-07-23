import { appPrisma } from '@nera/database';
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
 * to `appPrisma`, the least-privilege application client (P013A); construction
 * never queries the database.
 */
export function createOrganizationEngine(
  client: OrganizationEngineDbClient = appPrisma
): OrganizationEngine {
  return {
    getOrganizationContext: createGetOrganizationContext(client),
    assertInstitutionBelongsToOrganization: createAssertInstitutionBelongsToOrganization(client),
  };
}

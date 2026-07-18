import { type Entity } from './entity';
import { type Address, type Email, type Phone } from './contactMethods';

export type OrganizationType = 'company' | 'nonprofit' | 'institution' | 'government' | 'bank' | 'other';

/**
 * Organization-specific fields for an external/business-world entity such
 * as a supplier company, a bank, or a partner nonprofit.
 *
 * This is NOT the tenant/organization model that owns Nera data
 * (see apps/web demoOrganizations / SessionContext) - that is the
 * platform's own multi-organization tenant structure. An OrganizationProfile
 * describes a real-world organization the tenant does business with.
 */
export type OrganizationProfile = {
  entityId: string;
  displayName: string;
  legalName?: string;
  registrationNumber?: string;
  organizationType: OrganizationType;
  phones: Phone[];
  emails: Email[];
  addresses: Address[];
  website?: string;
};

/** An Entity narrowed to entityType 'organization', with its profile attached. */
export type OrganizationEntity = Entity & {
  entityType: 'organization';
  profile: OrganizationProfile;
};

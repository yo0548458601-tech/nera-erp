/**
 * "שם לחשבונית" (billing/invoice display name) and related billing
 * metadata. Deliberately NOT a base Entity or PersonProfile/
 * OrganizationProfile field - a universal mandatory field would force
 * every contact to carry billing concerns that only apply to specific
 * roles (suppliers, donors, customers, individual suppliers). Instead this
 * is a role-specific profile keyed by roleAssignmentId (see
 * financial.ts for the same pattern applied to financial streams): the
 * same entity can hold a different billing name per role assignment,
 * matching the platform rule that role-specific data must stay separated
 * rather than collapsed onto the shared entity record.
 */
export type BillingProfile = {
  id: string;
  /** The specific role assignment this billing identity belongs to - never the bare entityId. */
  roleAssignmentId: string;
  entityId: string;
  billingDisplayName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type NewBillingProfileInput = {
  roleAssignmentId: string;
  entityId: string;
  billingDisplayName: string;
  notes?: string;
};

export function getBillingProfileForRoleAssignment(
  profiles: BillingProfile[],
  roleAssignmentId: string
): BillingProfile | undefined {
  return profiles.find(profile => profile.roleAssignmentId === roleAssignmentId);
}

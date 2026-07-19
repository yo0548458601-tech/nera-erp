/**
 * Reusable entity-to-entity relationship model. UI components must read
 * relationship labels/behavior from this registry rather than hardcoding
 * relationship strings - keeps relationship rules in one place as new
 * relationship types are added.
 */
export type RelationshipType =
  | 'parent_of'
  | 'child_of'
  | 'spouse_of'
  | 'employee_of'
  | 'contact_person_of'
  | 'authorized_signer_of'
  | 'pays_for'
  | 'member_of';

export type RelationshipDefinition = {
  id: RelationshipType;
  label: string;
  /** The complementary relationship, if one exists (e.g. parent_of <-> child_of). */
  inverse?: RelationshipType;
};

export const relationshipRegistry: RelationshipDefinition[] = [
  { id: 'parent_of', label: 'הורה של', inverse: 'child_of' },
  { id: 'child_of', label: 'ילד/ה של', inverse: 'parent_of' },
  { id: 'spouse_of', label: 'בן/בת זוג של', inverse: 'spouse_of' },
  { id: 'employee_of', label: 'עובד/ת של' },
  { id: 'contact_person_of', label: 'איש קשר מטעם' },
  { id: 'authorized_signer_of', label: 'מורשה חתימה מטעם' },
  { id: 'pays_for', label: 'משלם/ת עבור' },
  { id: 'member_of', label: 'חבר/ה ב' },
];

export function getRelationshipLabel(type: RelationshipType): string {
  return relationshipRegistry.find(entry => entry.id === type)?.label ?? type;
}

export type RelationshipStatus = 'active' | 'ended';

export type EntityRelationship = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: RelationshipType;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  status: RelationshipStatus;
  notes?: string;
  /** Free-form extension bag for future relationship-specific data. */
  metadata?: Record<string, unknown>;
};

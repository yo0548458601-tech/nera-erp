/**
 * The set of concrete entity kinds the platform knows about. This union is
 * the extension point for future kinds (e.g. a future "household" or
 * "government_body" entity type) - adding one here, plus a matching
 * profile type and role/duplicate rules, does not require redesigning the
 * rest of the engine.
 */
export type EntityType = 'person' | 'organization';

export type EntityStatus = 'active' | 'inactive' | 'archived';

/**
 * Lightweight summary kept on the entity itself so lists can render note
 * counts without loading full note bodies. The actual Note records live in
 * their own collection (see notes.ts), each referencing entityId - this
 * mirrors how a real `entity_notes` database table would relate to
 * `entities` by foreign key rather than embedding.
 */
export type EntityNotesMetadata = {
  count: number;
  lastNoteAt?: string;
};

/**
 * The core identity record shared by every entity kind. Business/profile
 * specific fields (a person's name, an organization's registration number,
 * ...) never live here - they live in a dedicated profile type keyed by
 * entityId. See personProfile.ts / organizationProfile.ts.
 *
 * Shaped to map cleanly onto a future `entities` database table: UUID id,
 * tenant scoping, timestamps, soft delete - per the platform's database
 * conventions. There is no real database in this sprint.
 */
export type Entity = {
  id: string;
  /** Permanent internal identifier, e.g. "NERA-00000154". See neraId.ts. */
  neraId: string;
  entityType: EntityType;
  status: EntityStatus;
  tenantId: string;
  tags: string[];
  notesMetadata: EntityNotesMetadata;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

/**
 * A single field-level change record. This is the contract future
 * persistence must satisfy to support entity history - not a permanent
 * audit database. No history-storage backend exists in this sprint; in
 * demo mode these records simply live in memory alongside the entity they
 * describe.
 */
export type EntityFieldChange = {
  id: string;
  entityId: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  changedByUserId: string;
  changedAt: string;
  /** Required for some sensitive fields in the future (e.g. overriding a duplicate conflict); optional otherwise. */
  reason?: string;
};

/**
 * Diffs two flat field maps and returns one EntityFieldChange per field
 * that actually changed (by JSON-stable comparison). Intended for the
 * scalar/array fields of a profile, not for deep structural merging.
 */
export function diffEntityFields(
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changedByUserId: string,
  createId: () => string
): EntityFieldChange[] {
  const changes: EntityFieldChange[] = [];
  const now = new Date().toISOString();

  for (const field of Object.keys(after)) {
    const previousValue = before[field];
    const newValue = after[field];
    if (JSON.stringify(previousValue) === JSON.stringify(newValue)) {
      continue;
    }
    changes.push({
      id: createId(),
      entityId,
      field,
      previousValue,
      newValue,
      changedByUserId,
      changedAt: now,
    });
  }

  return changes;
}

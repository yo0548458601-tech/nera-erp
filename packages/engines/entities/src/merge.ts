import { type AnyEntity } from './unified';

export type EntityFieldConflict = {
  field: string;
  values: Array<{ entityId: string; value: unknown }>;
};

/**
 * A non-destructive preview of what merging a set of suspected-duplicate
 * entities would look like. Building this preview must never itself
 * perform a merge - entities are never merged automatically anywhere in
 * this engine.
 */
export type EntityMergePreview = {
  candidateEntityIds: string[];
  conflicts: EntityFieldConflict[];
};

export type EntityMergeResolution = {
  /** The entity id chosen to survive the merge; the others would be marked merged-away. */
  survivingEntityId: string;
  /** Manual, explicit resolution for each conflicting field, keyed by field name. */
  fieldResolutions: Record<string, unknown>;
};

/**
 * Extension point only, for a future merge flow (compare entities, preview
 * merge, select surviving entity, resolve field conflicts manually,
 * explicitly confirm merge). Does not persist anything and performs no
 * real conflict diffing yet - implementing destructive merge persistence
 * requires a real database and is out of scope for this sprint.
 */
export function prepareMergePreview(entities: AnyEntity[]): EntityMergePreview {
  return {
    candidateEntityIds: entities.map(entity => entity.id),
    conflicts: [],
  };
}

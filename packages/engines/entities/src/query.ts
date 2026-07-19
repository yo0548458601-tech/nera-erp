import { type AnyEntity, getEntityDisplayName, getEntityIdentifierNumber } from './unified';
import { type EntityStatus } from './entity';
import { type EntityRoleId, type RoleAssignment } from './roles';

export type EntitySortKey = 'name' | 'createdAt' | 'status';
export type SortDirection = 'asc' | 'desc';

export type EntityFilters = {
  status?: EntityStatus[];
  roles?: EntityRoleId[];
  tags?: string[];
};

export type EntityQueryOptions = {
  search?: string;
  filters?: EntityFilters;
  sortKey?: EntitySortKey;
  sortDirection?: SortDirection;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Every function below is generic over T extends AnyEntity so that calling
 * with e.g. PersonEntity[] yields PersonEntity[] back out, instead of
 * widening callers to the AnyEntity union - this matters once callers only
 * ever deal with one concrete entity kind (as apps/web does today, with
 * only person entities).
 */

/** Searches by display name, Nera ID, ID/registration number, phone, email, address (city/street), and tags. */
export function searchEntities<T extends AnyEntity>(entities: T[], search: string): T[] {
  const normalizedQuery = normalize(search);
  if (!normalizedQuery) {
    return entities;
  }

  return entities.filter(entity => {
    const haystacks = [
      getEntityDisplayName(entity),
      entity.neraId,
      getEntityIdentifierNumber(entity) ?? '',
      ...entity.profile.phones.map(phone => phone.number),
      ...entity.profile.emails.map(email => email.address),
      ...entity.profile.addresses.map(address => address.city ?? ''),
      ...entity.profile.addresses.map(address => address.street ?? ''),
      ...entity.tags,
    ];
    return haystacks.some(value => normalize(value).includes(normalizedQuery));
  });
}

export function filterEntitiesByStatusAndTags<T extends AnyEntity>(
  entities: T[],
  filters: Pick<EntityFilters, 'status' | 'tags'> = {}
): T[] {
  return entities.filter(entity => {
    if (filters.status && filters.status.length > 0 && !filters.status.includes(entity.status)) {
      return false;
    }
    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !filters.tags.some(tag => entity.tags.includes(tag))
    ) {
      return false;
    }
    return true;
  });
}

/** Role assignments are a separate collection (keyed by entityId), so role filtering needs them passed in explicitly. */
export function filterEntitiesByRole<T extends AnyEntity>(
  entities: T[],
  roleAssignments: RoleAssignment[],
  roles: EntityRoleId[]
): T[] {
  if (roles.length === 0) {
    return entities;
  }
  const matchingEntityIds = new Set(
    roleAssignments
      .filter(assignment => roles.includes(assignment.role))
      .map(assignment => assignment.entityId)
  );
  return entities.filter(entity => matchingEntityIds.has(entity.id));
}

export function sortEntities<T extends AnyEntity>(
  entities: T[],
  sortKey: EntitySortKey = 'name',
  direction: SortDirection = 'asc'
): T[] {
  const sorted = [...entities].sort((a, b) => {
    switch (sortKey) {
      case 'createdAt':
        return a.createdAt.localeCompare(b.createdAt);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'name':
      default:
        return getEntityDisplayName(a).localeCompare(getEntityDisplayName(b), 'he');
    }
  });

  return direction === 'desc' ? sorted.reverse() : sorted;
}

/** Convenience pipeline: search, then role/status/tag filter, then sort. */
export function queryEntities<T extends AnyEntity>(
  entities: T[],
  roleAssignments: RoleAssignment[],
  options: EntityQueryOptions = {}
): T[] {
  let result = entities;
  if (options.search) {
    result = searchEntities(result, options.search);
  }
  if (options.filters?.roles && options.filters.roles.length > 0) {
    result = filterEntitiesByRole(result, roleAssignments, options.filters.roles);
  }
  result = filterEntitiesByStatusAndTags(result, options.filters);
  return sortEntities(result, options.sortKey, options.sortDirection);
}

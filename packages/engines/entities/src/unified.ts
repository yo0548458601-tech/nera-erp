import { type PersonEntity, getPersonFullName } from './personProfile';
import { type OrganizationEntity } from './organizationProfile';

/** Any concrete entity, discriminated by entityType. Add new kinds here as they're introduced. */
export type AnyEntity = PersonEntity | OrganizationEntity;

export function isPersonEntity(entity: AnyEntity): entity is PersonEntity {
  return entity.entityType === 'person';
}

export function isOrganizationEntity(entity: AnyEntity): entity is OrganizationEntity {
  return entity.entityType === 'organization';
}

/** A display name that works for any entity kind - a person's full name, or an organization's display name. */
export function getEntityDisplayName(entity: AnyEntity): string {
  return isPersonEntity(entity) ? getPersonFullName(entity.profile) : entity.profile.displayName;
}

export function getEntityIdentifierNumber(entity: AnyEntity): string | undefined {
  return isPersonEntity(entity) ? entity.profile.idNumber : entity.profile.registrationNumber;
}

import { type CustomFieldValueData } from './customFields';

/**
 * A single stored value for one custom field on one target record (an
 * entity today; the `entityId` name is kept specific rather than a generic
 * `targetId` because every current use of custom fields targets an Entity
 * Engine record - a future module-scoped target would add its own value
 * type rather than overload this one).
 */
export type CustomFieldValue = {
  id: string;
  customFieldDefinitionId: string;
  entityId: string;
  value: CustomFieldValueData;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string;
};

export function getCustomFieldValuesForEntity(values: CustomFieldValue[], entityId: string): CustomFieldValue[] {
  return values.filter((value) => value.entityId === entityId);
}

export function findCustomFieldValue(values: CustomFieldValue[], entityId: string, customFieldDefinitionId: string): CustomFieldValue | undefined {
  return values.find((value) => value.entityId === entityId && value.customFieldDefinitionId === customFieldDefinitionId);
}

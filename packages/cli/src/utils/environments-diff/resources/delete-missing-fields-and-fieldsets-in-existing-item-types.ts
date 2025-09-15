import type { CmaClient } from '@datocms/cli-utils';
import { difference, intersection } from 'lodash';
import type { Command, ItemTypeInfo, Schema } from '../types';
import {
  buildFieldTitle,
  buildFieldsetTitle,
  buildItemTypeTitle,
} from '../utils';
import { buildComment } from './comments';

export function buildDestroyFieldClientCommand(
  field: CmaClient.RawApiTypes.Field,
  itemType: CmaClient.RawApiTypes.ItemType,
): Command[] {
  return [
    buildComment(
      `Delete ${buildFieldTitle(field)} in ${buildItemTypeTitle(itemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.fields.destroy',
      arguments: [field.id],
    },
  ];
}

export function buildDestroyFieldsetClientCommand(
  fieldset: CmaClient.RawApiTypes.Fieldset,
  itemType: CmaClient.RawApiTypes.ItemType,
): Command[] {
  return [
    buildComment(
      `Delete ${buildFieldsetTitle(fieldset)} in ${buildItemTypeTitle(
        itemType,
      )}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.fieldsets.destroy',
      arguments: [fieldset.id],
    },
  ];
}

export function deleteMissingFieldsAndFieldsetsInExistingItemType(
  newItemTypeSchema: ItemTypeInfo,
  oldItemTypeSchema: ItemTypeInfo,
): Command[] {
  const oldFieldIds = Object.keys(oldItemTypeSchema.fieldsById);
  const newFieldIds = Object.keys(newItemTypeSchema.fieldsById);

  const deletedFieldIds = difference(oldFieldIds, newFieldIds);

  const oldFieldsetIds = Object.keys(oldItemTypeSchema.fieldsetsById);
  const newFieldsetIds = Object.keys(newItemTypeSchema.fieldsetsById);

  const deletedFieldsetsIds = difference(oldFieldsetIds, newFieldsetIds);

  return [
    ...deletedFieldsetsIds.flatMap((fieldsetId) =>
      buildDestroyFieldsetClientCommand(
        oldItemTypeSchema.fieldsetsById[fieldsetId],
        newItemTypeSchema.entity,
      ),
    ),
    ...deletedFieldIds.flatMap((fieldId) =>
      buildDestroyFieldClientCommand(
        oldItemTypeSchema.fieldsById[fieldId],
        newItemTypeSchema.entity,
      ),
    ),
  ];
}

export function deleteMissingFieldsAndFieldsetsInExistingItemTypes(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const keptItemTypeIds = intersection(newItemTypeIds, oldItemTypeIds);

  const destroyCommands = keptItemTypeIds.flatMap((itemTypeId) =>
    deleteMissingFieldsAndFieldsetsInExistingItemType(
      newSchema.itemTypesById[itemTypeId],
      oldSchema.itemTypesById[itemTypeId],
    ),
  );

  if (destroyCommands.length === 0) {
    return [];
  }

  return [
    buildComment('Destroy fields in existing models/block models'),
    ...destroyCommands,
  ];
}

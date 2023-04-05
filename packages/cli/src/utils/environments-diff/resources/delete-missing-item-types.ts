import { difference } from 'lodash';
import { Command, ItemTypeInfo, Schema } from '../types';
import { buildItemTypeTitle } from '../utils';
import { buildComment } from './comments';

export function buildDestroyItemTypeClientCommand(
  itemTypeSchema: ItemTypeInfo,
): Command[] {
  return [
    buildComment(`Delete ${buildItemTypeTitle(itemTypeSchema.entity)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.itemTypes.destroy',
      arguments: [itemTypeSchema.entity.id, { skip_menu_items_deletion: true }],
    },
  ];
}

export function deleteMissingItemTypes(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const destroyedItemTypeIds = difference(oldItemTypeIds, newItemTypeIds);

  if (destroyedItemTypeIds.length === 0) {
    return [];
  }

  return [
    buildComment('Destroy models/block models'),
    ...destroyedItemTypeIds.flatMap((itemTypeId) =>
      buildDestroyItemTypeClientCommand(oldSchema.itemTypesById[itemTypeId]),
    ),
  ];
}

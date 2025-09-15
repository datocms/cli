import type { CmaClient } from '@datocms/cli-utils';
import { difference, intersection, isEqual, pick } from 'lodash';
import type { Command, Schema } from '../types';
import {
  buildItemTypeFilterTitle,
  buildItemTypeTitle,
  isBase64Id,
} from '../utils';
import { buildComment } from './comments';

function buildCreateItemTypeFilterClientCommand(
  itemTypeFilter: CmaClient.RawApiTypes.ItemTypeFilter,
  itemType: CmaClient.RawApiTypes.ItemType,
): Command[] {
  return [
    buildComment(
      `Create ${buildItemTypeFilterTitle(
        itemTypeFilter,
      )} of ${buildItemTypeTitle(itemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.itemTypeFilters.create',
      arguments: [
        {
          data: {
            type: 'item_type_filter',
            id: isBase64Id(itemTypeFilter.id) ? itemTypeFilter.id : undefined,
            attributes: itemTypeFilter.attributes,
            relationships: itemTypeFilter.relationships,
          },
        },
      ],
      oldEnvironmentId: itemTypeFilter.id,
    },
  ];
}

function buildDestroyItemTypeFilterClientCommand(
  itemTypeFilter: CmaClient.RawApiTypes.ItemTypeFilter,
  itemType: CmaClient.RawApiTypes.ItemType,
): Command[] {
  return [
    buildComment(
      `Delete ${buildItemTypeFilterTitle(
        itemTypeFilter,
      )} of ${buildItemTypeTitle(itemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.itemTypeFilters.destroy',
      arguments: [itemTypeFilter.id],
    },
  ];
}

function buildUpdateItemTypeFilterClientCommand(
  newItemTypeFilter: CmaClient.RawApiTypes.ItemTypeFilter,
  oldItemTypeFilter: CmaClient.RawApiTypes.ItemTypeFilter,
  itemType: CmaClient.RawApiTypes.ItemType,
): Command[] {
  const attributesToUpdate = pick(
    newItemTypeFilter.attributes,
    (
      Object.keys(newItemTypeFilter.attributes) as Array<
        keyof CmaClient.RawApiTypes.ItemTypeFilterAttributes
      >
    ).filter(
      (attribute) =>
        !isEqual(
          oldItemTypeFilter.attributes[attribute],
          newItemTypeFilter.attributes[attribute],
        ),
    ),
  );

  if (Object.keys(attributesToUpdate).length === 0) {
    return [];
  }

  return [
    buildComment(
      `Update ${buildItemTypeFilterTitle(
        newItemTypeFilter,
      )} of ${buildItemTypeTitle(itemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.itemTypeFilters.update',
      arguments: [
        oldItemTypeFilter.id,
        {
          data: {
            type: 'item_type_filter',
            id: oldItemTypeFilter.id,

            attributes: attributesToUpdate,
          },
        },
      ],
    },
  ];
}

export function manageItemTypeFilters(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const oldEntityIds = Object.keys(oldSchema.itemTypeFiltersById);
  const newEntityIds = Object.keys(newSchema.itemTypeFiltersById);

  const keptEntityIds = intersection(oldEntityIds, newEntityIds);

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (itemTypeFilterId) => oldSchema.itemTypeFiltersById[itemTypeFilterId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (itemTypeFilterId) => newSchema.itemTypeFiltersById[itemTypeFilterId],
  );

  const commands: Command[] = [
    ...deletedEntities.flatMap((entity) =>
      buildDestroyItemTypeFilterClientCommand(
        entity,
        oldSchema.itemTypesById[entity.relationships.item_type.data.id].entity,
      ),
    ),
    ...createdEntities.flatMap((entity) =>
      buildCreateItemTypeFilterClientCommand(
        entity,
        newSchema.itemTypesById[entity.relationships.item_type.data.id].entity,
      ),
    ),
    ...keptEntityIds.flatMap((itemTypeFilterId) =>
      buildUpdateItemTypeFilterClientCommand(
        newSchema.itemTypeFiltersById[itemTypeFilterId],
        oldSchema.itemTypeFiltersById[itemTypeFilterId],
        newSchema.itemTypesById[
          newSchema.itemTypeFiltersById[itemTypeFilterId].relationships
            .item_type.data.id
        ].entity,
      ),
    ),
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Manage model filters'), ...commands];
}

import { difference, intersection, isEqual, pick, without } from 'lodash';
import { CmaClient } from '@datocms/cli-utils';
import { Command, ItemTypeInfo, Schema } from '../types';
import { buildItemTypeTitle } from '../utils';
import { buildComment } from './comments';
import {
  attributesToIgnoreOnBlockModels,
  attributesToIgnoreOnModels,
} from './create-new-item-types';

const relationshipsToIgnoreOnModelBlocks: Array<
  keyof CmaClient.SchemaTypes.ItemTypeRelationships
> = [
  'ordering_field',
  'title_field',
  'image_preview_field',
  'excerpt_field',
  'workflow',
  'fields',
  'fieldsets',
  'singleton_item',
];

const relationshipsToIgnoreOnModels: Array<
  keyof CmaClient.SchemaTypes.ItemTypeRelationships
> = ['fields', 'fieldsets', 'singleton_item'];

const defaultRelationshipsOnCreatedItemTypes: Partial<CmaClient.SchemaTypes.ItemTypeRelationships> =
  {
    ordering_field: { data: null },
    title_field: { data: null },
    image_preview_field: { data: null },
    excerpt_field: { data: null },
    workflow: { data: null },
  };

export function finalizeItemType(
  newItemTypeSchema: ItemTypeInfo,
  oldItemTypeSchema?: ItemTypeInfo,
): Command[] {
  const oldItemType = oldItemTypeSchema?.entity;
  const newItemType = newItemTypeSchema.entity;

  const changedAttributes = oldItemTypeSchema
    ? (
        Object.keys(newItemType.attributes) as Array<
          keyof CmaClient.SchemaTypes.ItemTypeAttributes
        >
      ).filter(
        (attribute) =>
          !(
            oldItemType &&
            isEqual(
              oldItemType.attributes[attribute],
              newItemType.attributes[attribute],
            )
          ),
      )
    : ['ordering_direction', 'ordering_meta'];

  const attributesToUpdate = pick(
    newItemType.attributes,
    without(
      changedAttributes,
      ...(newItemType.attributes.modular_block
        ? attributesToIgnoreOnBlockModels
        : attributesToIgnoreOnModels),
    ),
  );

  const changedRelationships = (
    Object.keys(newItemType.relationships) as Array<
      keyof CmaClient.SchemaTypes.ItemTypeRelationships
    >
  ).filter(
    (relationship) =>
      !isEqual(
        oldItemType
          ? oldItemType.relationships[relationship]
          : defaultRelationshipsOnCreatedItemTypes[relationship],
        newItemType.relationships[relationship],
      ),
  );

  const relationshipsToUpdate = pick(
    newItemType.relationships,
    without(
      changedRelationships,
      ...(newItemType.attributes.modular_block
        ? relationshipsToIgnoreOnModelBlocks
        : relationshipsToIgnoreOnModels),
      ...(!oldItemType ? ['workflow'] : []),
    ),
  );

  const updateItemTypeCommands: Command[] =
    Object.keys(attributesToUpdate).length > 0 ||
    Object.keys(relationshipsToUpdate).length > 0
      ? [
          {
            type: 'apiCallClientCommand',
            call: 'client.itemTypes.update',
            arguments: [
              newItemType.id,
              {
                data: {
                  id: newItemType.id,
                  type: 'item_type',
                  ...(Object.keys(attributesToUpdate).length > 0
                    ? { attributes: attributesToUpdate }
                    : {}),
                  ...(Object.keys(relationshipsToUpdate).length > 0
                    ? { relationships: relationshipsToUpdate }
                    : {}),
                },
              },
            ],
          },
        ]
      : [];

  if (updateItemTypeCommands.length === 0) {
    return [];
  }

  return [
    buildComment(`Update ${buildItemTypeTitle(newItemType)}`),
    ...updateItemTypeCommands,
  ];
}

export function finalizeItemTypes(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const createdItemTypeIds = difference(newItemTypeIds, oldItemTypeIds);
  const keptItemTypeIds = intersection(newItemTypeIds, oldItemTypeIds);

  const commands = [...createdItemTypeIds, ...keptItemTypeIds].flatMap(
    (itemTypeId) =>
      finalizeItemType(
        newSchema.itemTypesById[itemTypeId],
        oldSchema.itemTypesById[itemTypeId],
      ),
  );

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Finalize models/block models'), ...commands];
}

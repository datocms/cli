import type { CmaClient } from '@datocms/cli-utils';
import { difference, isEqual, pick, without } from 'lodash';
import type { Command, ItemTypeInfo, Schema } from '../types';
import { buildItemTypeTitle, isBase64Id } from '../utils';
import { buildLog } from './comments';

const defaultValuesForItemTypeAttribute: Partial<CmaClient.SchemaTypes.ItemTypeAttributes> =
  {
    hint: null,
    draft_mode_active: false,
    sortable: false,
    tree: false,
    singleton: false,
    modular_block: false,
    all_locales_required: false,
    ordering_meta: null,
    collection_appearance: 'compact',
  };

export const attributesToIgnoreOnModels: Array<
  keyof CmaClient.SchemaTypes.ItemTypeAttributes
> = [
  'collection_appeareance',
  'ordering_direction',
  'ordering_meta',
  'has_singleton_item',
];

export const attributesToIgnoreOnBlockModels: Array<
  keyof CmaClient.SchemaTypes.ItemTypeAttributes
> = [
  'all_locales_required',
  'collection_appearance',
  'collection_appeareance',
  'draft_mode_active',
  'has_singleton_item',
  'ordering_direction',
  'ordering_meta',
  'singleton',
  'sortable',
  'tree',
];

function buildCreateItemTypeClientCommand(
  itemTypeSchema: ItemTypeInfo,
  schemaMenuItem: CmaClient.SchemaTypes.SchemaMenuItem,
): Command[] {
  const itemType = itemTypeSchema.entity;

  const attributesToUpdate = pick(
    itemType.attributes,
    without(
      (
        Object.keys(itemType.attributes) as Array<
          keyof CmaClient.SchemaTypes.ItemTypeAttributes
        >
      ).filter(
        (attribute) =>
          !isEqual(
            defaultValuesForItemTypeAttribute[attribute],
            itemType.attributes[attribute] as unknown,
          ),
      ),
      ...(itemType.attributes.modular_block
        ? attributesToIgnoreOnBlockModels
        : attributesToIgnoreOnModels),
    ),
  );

  return [
    buildLog(`Create ${buildItemTypeTitle(itemType)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.itemTypes.create',
      arguments: [
        {
          data: {
            type: 'item_type',
            id: isBase64Id(itemType.id) ? itemType.id : undefined,
            attributes: attributesToUpdate,
            ...(itemType.relationships.workflow.data
              ? { relationships: pick(itemType.relationships, 'workflow') }
              : {}),
          },
        },
        {
          skip_menu_item_creation: true,
          schema_menu_item_id: schemaMenuItem.id,
        },
      ],
      oldEnvironmentId: itemType.id,
    },
  ];
}

export function createNewItemTypes(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const createdItemTypeIds = difference(newItemTypeIds, oldItemTypeIds);

  if (createdItemTypeIds.length === 0) {
    return [];
  }

  return [
    buildLog('Create new models/block models'),
    ...createdItemTypeIds.flatMap((itemTypeId) => {
      const schemaMenuItem = Object.values(newSchema.schemaMenuItemsById).find(
        (item) => item.relationships.item_type.data?.id === itemTypeId,
      )!;

      return buildCreateItemTypeClientCommand(
        newSchema.itemTypesById[itemTypeId],
        schemaMenuItem,
      );
    }),
  ];
}

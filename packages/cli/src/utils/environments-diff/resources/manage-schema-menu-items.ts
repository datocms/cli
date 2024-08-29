import type { CmaClient } from '@datocms/cli-utils';
import { difference, intersection, isEqual, omit, pick } from 'lodash';
import type {
  Command,
  ReorderSchemaMenuItemsClientCommand,
  Schema,
} from '../types';
import { buildSchemaMenuItemTitle, isBase64Id } from '../utils';
import { buildReorderCommand } from './build-reorder-command';
import { buildLog } from './comments';

function buildCreateSchemaMenuItemClientCommand(
  schemaMenuItem: CmaClient.SchemaTypes.SchemaMenuItem,
  itemType: CmaClient.SchemaTypes.ItemType | undefined,
): Command[] {
  const attributes = omit(schemaMenuItem.attributes, ['position']);

  return [
    buildLog(`Create ${buildSchemaMenuItemTitle(schemaMenuItem, itemType)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.schemaMenuItems.create',
      arguments: [
        {
          data: {
            type: 'schema_menu_item',
            id: isBase64Id(schemaMenuItem.id) ? schemaMenuItem.id : undefined,
            attributes: attributes,
            relationships: Object.fromEntries(
              Object.entries(
                omit(schemaMenuItem.relationships, ['children', 'parent']),
              ).filter(([_key, value]) => !!value.data),
            ),
          },
        },
      ],
      oldEnvironmentId: schemaMenuItem.id,
    },
  ];
}

function buildDestroySchemaMenuItemClientCommand(
  schemaMenuItem: CmaClient.SchemaTypes.SchemaMenuItem,
  itemType: CmaClient.SchemaTypes.ItemType | undefined,
): Command[] {
  return [
    buildLog(`Delete ${buildSchemaMenuItemTitle(schemaMenuItem, itemType)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.schemaMenuItems.destroy',
      arguments: [schemaMenuItem.id],
    },
  ];
}

function buildUpdateSchemaMenuItemClientCommand(
  newSchemaMenuItem: CmaClient.SchemaTypes.SchemaMenuItem,
  oldSchemaMenuItem: CmaClient.SchemaTypes.SchemaMenuItem,
  newItemType: CmaClient.SchemaTypes.ItemType | undefined,
): Command[] {
  const attributesToUpdate = pick(
    newSchemaMenuItem.attributes,
    (
      Object.keys(omit(newSchemaMenuItem.attributes, ['position'])) as Array<
        keyof CmaClient.SchemaTypes.SchemaMenuItemAttributes
      >
    ).filter(
      (attribute) =>
        !isEqual(
          oldSchemaMenuItem.attributes[attribute],
          newSchemaMenuItem.attributes[attribute],
        ),
    ),
  );

  const relationshipsToUpdate = pick(
    newSchemaMenuItem.relationships,
    (
      Object.keys(
        omit(newSchemaMenuItem.relationships, ['children', 'parent']),
      ) as Array<keyof CmaClient.SchemaTypes.SchemaMenuItemRelationships>
    ).filter(
      (attribute) =>
        !isEqual(
          oldSchemaMenuItem.relationships[attribute],
          newSchemaMenuItem.relationships[attribute],
        ),
    ),
  );

  if (
    Object.keys(attributesToUpdate).length === 0 &&
    (!relationshipsToUpdate || Object.keys(relationshipsToUpdate).length === 0)
  ) {
    return [];
  }

  return [
    buildLog(
      `Update ${buildSchemaMenuItemTitle(newSchemaMenuItem, newItemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.schemaMenuItems.update',
      arguments: [
        newSchemaMenuItem.id,
        {
          data: {
            type: 'schema_menu_item',
            id: newSchemaMenuItem.id,
            attributes: attributesToUpdate,
            ...(relationshipsToUpdate &&
            Object.keys(relationshipsToUpdate).length > 0
              ? { relationships: relationshipsToUpdate }
              : {}),
          },
        },
      ],
    },
  ];
}

export function manageSchemaMenuItems(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const oldEntityIds = Object.keys(oldSchema.schemaMenuItemsById);
  const newEntityIds = Object.keys(newSchema.schemaMenuItemsById);

  const deletedEntities = difference(oldEntityIds, newEntityIds)
    .map((schemaMenuItemId) => oldSchema.schemaMenuItemsById[schemaMenuItemId])
    .filter((schemaMenuItem) => !schemaMenuItem.relationships.item_type.data);

  const createdEntities = difference(newEntityIds, oldEntityIds)
    .map((schemaMenuItemId) => newSchema.schemaMenuItemsById[schemaMenuItemId])
    .filter((schemaMenuItem) => !schemaMenuItem.relationships.item_type.data);

  const keptEntities = intersection(oldEntityIds, newEntityIds).map(
    (id) =>
      [
        newSchema.schemaMenuItemsById[id],
        oldSchema.schemaMenuItemsById[id],
      ] as [
        CmaClient.SchemaTypes.SchemaMenuItem,
        CmaClient.SchemaTypes.SchemaMenuItem,
      ],
  );

  const createCommands = createdEntities.flatMap((entity) =>
    buildCreateSchemaMenuItemClientCommand(
      entity,
      entity.relationships.item_type.data
        ? oldSchema.itemTypesById[entity.relationships.item_type.data.id].entity
        : undefined,
    ),
  );

  const deleteCommands = deletedEntities.flatMap((entity) =>
    buildDestroySchemaMenuItemClientCommand(
      entity,
      entity.relationships.item_type.data
        ? oldSchema.itemTypesById[entity.relationships.item_type.data.id].entity
        : undefined,
    ),
  );

  const updateCommands = keptEntities.flatMap(([newEntity, oldEntity]) =>
    buildUpdateSchemaMenuItemClientCommand(
      newEntity,
      oldEntity,
      newEntity.relationships.item_type.data
        ? oldSchema.itemTypesById[newEntity.relationships.item_type.data.id]
            .entity
        : undefined,
    ),
  );

  const reorderCommands = buildReorderCommand<
    'schema_menu_item',
    ReorderSchemaMenuItemsClientCommand
  >('client.schemaMenuItems.reorder', keptEntities, createdEntities);

  const commands: Command[] = [
    ...createCommands,
    ...deleteCommands,
    ...updateCommands,
    ...reorderCommands,
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildLog('Manage schema menu items'), ...commands];
}

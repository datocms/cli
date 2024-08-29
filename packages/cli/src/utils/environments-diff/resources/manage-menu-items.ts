import type { CmaClient } from '@datocms/cli-utils';
import { difference, intersection, isEqual, omit, pick, without } from 'lodash';
import type { Command, ReorderMenuItemsClientCommand, Schema } from '../types';
import { buildMenuItemTitle, isBase64Id } from '../utils';
import { buildReorderCommand } from './build-reorder-command';
import { buildLog } from './comments';

const defaultValuesForMenuItemAttribute: Partial<CmaClient.SchemaTypes.MenuItemAttributes> =
  {
    external_url: null,
    open_in_new_tab: false,
  };

function buildCreateMenuItemClientCommand(
  menuItem: CmaClient.SchemaTypes.MenuItem,
): Command[] {
  const attributesToPick = (
    Object.keys(menuItem.attributes) as Array<
      keyof CmaClient.SchemaTypes.MenuItemAttributes
    >
  ).filter(
    (attribute) =>
      !isEqual(
        defaultValuesForMenuItemAttribute[attribute],
        menuItem.attributes[attribute],
      ),
  );

  const attributes = pick(
    menuItem.attributes,
    without(attributesToPick, 'position'),
  );

  return [
    buildLog(`Create ${buildMenuItemTitle(menuItem)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.menuItems.create',
      arguments: [
        {
          data: {
            type: 'menu_item',
            id: isBase64Id(menuItem.id) ? menuItem.id : undefined,
            attributes: attributes,
            relationships: Object.fromEntries(
              Object.entries(
                omit(menuItem.relationships, ['children', 'parent']),
              ).filter(([_key, value]) => !!value.data),
            ),
          },
        },
      ],
      oldEnvironmentId: menuItem.id,
    },
  ];
}

function buildDestroyMenuItemClientCommand(
  menuItem: CmaClient.SchemaTypes.MenuItem,
): Command[] {
  return [
    buildLog(`Delete ${buildMenuItemTitle(menuItem)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.menuItems.destroy',
      arguments: [menuItem.id],
    },
  ];
}

function buildUpdateMenuItemClientCommand(
  newMenuItem: CmaClient.SchemaTypes.MenuItem,
  oldMenuItem: CmaClient.SchemaTypes.MenuItem,
): Command[] {
  const attributesToUpdate = pick(
    newMenuItem.attributes,
    (
      Object.keys(omit(newMenuItem.attributes, ['position'])) as Array<
        keyof CmaClient.SchemaTypes.MenuItemAttributes
      >
    ).filter(
      (attribute) =>
        !isEqual(
          oldMenuItem.attributes[attribute],
          newMenuItem.attributes[attribute],
        ),
    ),
  );

  const relationshipsToUpdate = pick(
    newMenuItem.relationships,
    (
      Object.keys(
        omit(newMenuItem.relationships, ['children', 'parent']),
      ) as Array<keyof CmaClient.SchemaTypes.MenuItemRelationships>
    ).filter(
      (relationship) =>
        relationship !== 'parent' &&
        !isEqual(
          oldMenuItem.relationships[relationship],
          newMenuItem.relationships[relationship],
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
    buildLog(`Update ${buildMenuItemTitle(newMenuItem)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.menuItems.update',
      arguments: [
        newMenuItem.id,
        {
          data: {
            type: 'menu_item',
            id: newMenuItem.id,
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

export function manageMenuItems(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const oldEntityIds = Object.keys(oldSchema.menuItemsById);
  const newEntityIds = Object.keys(newSchema.menuItemsById);

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (menuItemId) => oldSchema.menuItemsById[menuItemId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (menuItemId) => newSchema.menuItemsById[menuItemId],
  );

  const keptEntities = intersection(oldEntityIds, newEntityIds).map(
    (id) =>
      [newSchema.menuItemsById[id], oldSchema.menuItemsById[id]] as [
        CmaClient.SchemaTypes.MenuItem,
        CmaClient.SchemaTypes.MenuItem,
      ],
  );

  const createCommands = createdEntities.flatMap((entity) =>
    buildCreateMenuItemClientCommand(entity),
  );

  const deleteCommands = deletedEntities.flatMap((entity) =>
    buildDestroyMenuItemClientCommand(entity),
  );

  const updateCommands = keptEntities.flatMap(([newEntity, oldEntity]) =>
    buildUpdateMenuItemClientCommand(newEntity, oldEntity),
  );

  const reorderCommands = buildReorderCommand<
    'menu_item',
    ReorderMenuItemsClientCommand
  >('client.menuItems.reorder', keptEntities, createdEntities);

  const commands: Command[] = [
    ...createCommands,
    ...deleteCommands,
    ...updateCommands,
    ...reorderCommands,
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildLog('Manage menu items'), ...commands];
}

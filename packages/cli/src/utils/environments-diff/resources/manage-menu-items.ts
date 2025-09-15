import type { CmaClient } from '@datocms/cli-utils';
import {
  cloneDeep,
  difference,
  intersection,
  isEqual,
  omit,
  pick,
  sortBy,
  without,
} from 'lodash';
import type { Command, Schema, UpdateMenuItemClientCommand } from '../types';
import { buildMenuItemTitle, isBase64Id } from '../utils';
import { buildComment } from './comments';

const defaultValuesForMenuItemAttribute: Partial<CmaClient.RawApiTypes.MenuItemAttributes> =
  {
    external_url: null,
    open_in_new_tab: false,
  };

function buildCreateMenuItemClientCommand(
  menuItem: CmaClient.RawApiTypes.MenuItem,
): Command[] {
  const attributesToPick = (
    Object.keys(menuItem.attributes) as Array<
      keyof CmaClient.RawApiTypes.MenuItemAttributes
    >
  ).filter(
    (attribute) =>
      !isEqual(
        defaultValuesForMenuItemAttribute[attribute],
        menuItem.attributes[attribute],
      ),
  );

  const attributesToUpdate = pick(
    menuItem.attributes,
    without(attributesToPick, 'position'),
  );

  return [
    buildComment(`Create ${buildMenuItemTitle(menuItem)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.menuItems.create',
      arguments: [
        {
          data: {
            type: 'menu_item',
            id: isBase64Id(menuItem.id) ? menuItem.id : undefined,
            attributes: attributesToUpdate,
            relationships: Object.fromEntries(
              Object.entries(omit(menuItem.relationships, 'children')).filter(
                ([_key, value]) => !!value.data,
              ),
            ),
          },
        },
      ],
      oldEnvironmentId: menuItem.id,
    },
  ];
}

function buildDestroyMenuItemClientCommand(
  menuItem: CmaClient.RawApiTypes.MenuItem,
): Command[] {
  return [
    buildComment(`Delete ${buildMenuItemTitle(menuItem)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.menuItems.destroy',
      arguments: [menuItem.id],
    },
  ];
}

function buildUpdateMenuItemClientCommand(
  newMenuItem: CmaClient.RawApiTypes.MenuItem,
  oldMenuItem: CmaClient.RawApiTypes.MenuItem | undefined,
): Command[] {
  const attributesToUpdate = oldMenuItem
    ? pick(
        newMenuItem.attributes,
        (
          Object.keys(newMenuItem.attributes) as Array<
            keyof CmaClient.RawApiTypes.MenuItemAttributes
          >
        ).filter(
          (attribute) =>
            !isEqual(
              oldMenuItem.attributes[attribute],
              newMenuItem.attributes[attribute],
            ),
        ),
      )
    : pick(newMenuItem.attributes, 'position');

  const relationshipsToUpdate = oldMenuItem
    ? pick(
        newMenuItem.relationships,
        (
          Object.keys(omit(newMenuItem.relationships, 'children')) as Array<
            keyof CmaClient.RawApiTypes.MenuItemRelationships
          >
        ).filter(
          (attribute) =>
            !isEqual(
              oldMenuItem.relationships[attribute],
              newMenuItem.relationships[attribute],
            ),
        ),
      )
    : null;

  if (
    Object.keys(attributesToUpdate).length === 0 &&
    (!relationshipsToUpdate || Object.keys(relationshipsToUpdate).length === 0)
  ) {
    return [];
  }

  return [
    buildComment(`Update ${buildMenuItemTitle(newMenuItem)}`),
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

function findSiblings({
  of: entity,
  collection,
  parentId,
  positionGte,
}: {
  of: CmaClient.RawApiTypes.MenuItem;
  collection: CmaClient.RawApiTypes.MenuItem[];
  parentId: string | undefined;
  positionGte: number;
}) {
  const siblings = collection.filter(
    (entity) => entity.relationships.parent.data?.id === parentId,
  );

  return siblings
    .filter((e) => e.id !== entity.id || e.type !== entity.type)
    .filter((e) => e.attributes.position >= positionGte);
}

function findChildren({
  of: entity,
  collection,
}: {
  of: CmaClient.RawApiTypes.MenuItem;
  collection: CmaClient.RawApiTypes.MenuItem[];
}) {
  return collection.filter(
    (e) => e.relationships.parent.data?.id === entity.id,
  );
}

function findMaxPosition({
  collection,
  parentId,
}: {
  collection: CmaClient.RawApiTypes.MenuItem[];
  parentId: string | undefined;
}) {
  const siblings = collection.filter(
    (entity) => entity.relationships.parent.data?.id === parentId,
  );

  return siblings.reduce((max, e) => Math.max(max, e.attributes.position), 0);
}

function generateInitialState({
  oldKeptEntities,
  createdEntities,
  deletedEntities,
}: {
  oldKeptEntities: CmaClient.RawApiTypes.MenuItem[];
  createdEntities: CmaClient.RawApiTypes.MenuItem[];
  deletedEntities: CmaClient.RawApiTypes.MenuItem[];
}) {
  const state = oldKeptEntities.map(cloneDeep);

  createdEntities.forEach((entity) => {
    const newEntity = cloneDeep(entity);

    newEntity.attributes.position =
      findMaxPosition({
        collection: state,
        parentId: entity.relationships.parent.data?.id,
      }) + 1;

    state.push(newEntity);
  });

  deletedEntities.forEach((deletedEntity) => {
    findSiblings({
      of: deletedEntity,
      collection: state,
      parentId: deletedEntity.relationships.parent.data?.id,
      positionGte: deletedEntity.attributes.position,
    }).forEach((entity) => {
      entity.attributes.position -= 1;
    });

    findChildren({ of: deletedEntity, collection: state }).forEach(
      (entityInState) => {
        entityInState.relationships.parent.data = null;
        entityInState.attributes.position =
          findMaxPosition({
            collection: state,
            parentId: undefined,
          }) + 1;
      },
    );
  });

  return state;
}

class InvalidMovement extends Error {}

function updateState({
  updateCommand,
  state,
}: {
  updateCommand: UpdateMenuItemClientCommand;
  state: CmaClient.RawApiTypes.MenuItem[];
}) {
  const entityId = updateCommand.arguments[0];

  const entityInState = state.find((e) => e.id === entityId)!;

  const entityParentIdBeforeUpdate =
    entityInState.relationships.parent.data?.id;

  const entityPositionBeforeUpdate = entityInState.attributes.position;

  const entityParentIdAfterUpdate = updateCommand.arguments[1].data
    .relationships?.parent
    ? updateCommand.arguments[1].data.relationships?.parent.data?.id
    : entityParentIdBeforeUpdate;

  const entityPositionAfterUpdate =
    updateCommand.arguments[1].data.attributes &&
    'position' in updateCommand.arguments[1].data.attributes
      ? updateCommand.arguments[1].data.attributes.position!
      : entityPositionBeforeUpdate;

  // console.log('entityParentIdBeforeUpdate', entityParentIdBeforeUpdate);
  // console.log('entityPositionBeforeUpdate', entityPositionBeforeUpdate);
  // console.log('entityParentIdAfterUpdate', entityParentIdAfterUpdate);
  // console.log('entityPositionAfterUpdate', entityPositionAfterUpdate);

  entityInState.attributes.position = entityPositionAfterUpdate;

  entityInState.relationships.parent.data = entityParentIdAfterUpdate
    ? { id: entityParentIdAfterUpdate, type: 'menu_item' }
    : null;

  findSiblings({
    of: entityInState,
    collection: state,
    parentId: entityParentIdBeforeUpdate,
    positionGte: entityPositionBeforeUpdate,
  }).forEach((entity) => {
    entity.attributes.position -= 1;
  });

  findSiblings({
    of: entityInState,
    collection: state,
    parentId: entityParentIdAfterUpdate,
    positionGte: entityPositionAfterUpdate,
  }).forEach((entity) => {
    entity.attributes.position += 1;
  });
}

export function debugState(
  message: string,
  state: CmaClient.RawApiTypes.MenuItem[],
  rawRoots: CmaClient.RawApiTypes.MenuItem[] = state.filter(
    (entity) => !entity.relationships.parent.data,
  ),
  level = 0,
) {
  if (message) {
    console.log(`\n\n${message}`);
  }

  const roots = sortBy(rawRoots, (e) => e.attributes.position);

  roots.forEach((root) => {
    console.log(
      `${'  '.repeat(level)}${root.attributes.position}. ${
        root.attributes.label
      } (${root.id})`,
    );

    debugState(
      '',
      state,
      state.filter(
        (entity) => entity.relationships.parent.data?.id === root.id,
      ),
      level + 1,
    );
  });
}

function buildUpdateCommands(newSchema: Schema, oldSchema: Schema) {
  const oldEntityIds = Object.keys(oldSchema.menuItemsById);
  const newEntityIds = Object.keys(newSchema.menuItemsById);

  const oldKeptEntities = intersection(oldEntityIds, newEntityIds).map(
    (menuItemId) => oldSchema.menuItemsById[menuItemId],
  );

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (menuItemId) => oldSchema.menuItemsById[menuItemId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (menuItemId) => newSchema.menuItemsById[menuItemId],
  );

  function run(mode: 'smart' | 'dumb') {
    const state = generateInitialState({
      oldKeptEntities,
      deletedEntities,
      createdEntities,
    });

    const sortedEntitiesToProcess = sortBy(
      newEntityIds.map((menuItemId) => newSchema.menuItemsById[menuItemId]),
      (entity) => {
        if (mode === 'dumb') {
          return entity.attributes.position;
        }

        // we try to start moving items that are more distant from their original
        // position. this can generate a lower number of ops, but we're not
        // mathematically sure that operations are legal :D

        const entityInState = state.find(
          (e) => e.id === entity.id && e.type === entity.type,
        )!;

        let weight = Math.abs(
          entity.attributes.position - entityInState.attributes.position,
        );

        if (
          entityInState.relationships.parent.data?.id !==
          entity.relationships.parent.data?.id
        ) {
          weight += 100;
        }

        return -weight;
      },
    );

    // debugState(`INITIAL (${mode})`, state);

    let commands: Command[] = [];

    while (sortedEntitiesToProcess.length > 0) {
      const entityToProcess = sortedEntitiesToProcess.shift()!;
      const entityInState = state.find(
        (e) => e.id === entityToProcess.id && e.type === entityToProcess.type,
      )!;

      const entityCommands = buildUpdateMenuItemClientCommand(
        entityToProcess,
        entityInState,
      );

      commands = [...commands, ...entityCommands];

      // console.log(`\nProcesso ${entityToProcess.attributes.label}`);

      entityCommands
        .filter(
          (c): c is UpdateMenuItemClientCommand =>
            c.type === 'apiCallClientCommand' &&
            c.call === 'client.menuItems.update',
        )
        .forEach((updateCommand) =>
          updateState({
            updateCommand,
            state,
          }),
        );

      // if (entityCommands.length > 0) {
      //   debugState('RESULT', state);
      // }
    }

    return commands;
  }

  try {
    return run('smart');
  } catch (e) {
    if (e instanceof InvalidMovement) {
      return run('dumb');
    }

    throw e;
  }
}

function sortByDepth(entities: CmaClient.RawApiTypes.MenuItem[]) {
  type Node = {
    entity: CmaClient.RawApiTypes.MenuItem;
    children: Node[];
    depth: number;
  };

  const nodes: Node[] = entities.map((entity) => ({
    entity,
    children: [],
    depth: 0,
  }));

  const map = Object.fromEntries(nodes.map((node) => [node.entity.id, node]));

  const tree: Node[] = [];

  nodes.forEach((node) => {
    const parentId = node.entity.relationships.parent.data?.id;
    if (parentId && entities.find((e) => e.id === parentId)) {
      map[parentId].children.push(node);
    } else {
      tree.push(node);
    }
  });

  const sortedNodes: Node[] = [];

  function visit(node: Node, depth: number) {
    node.depth = depth;
    sortedNodes.push(node);
    node.children.forEach((child) => visit(child, depth + 1));
  }

  tree.forEach((node) => visit(node, 0));

  return sortedNodes
    .sort((a, b) => a.depth - b.depth)
    .map((node) => node.entity);
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

  const createCommands = sortByDepth(createdEntities).flatMap((entity) =>
    buildCreateMenuItemClientCommand(entity),
  );

  const deleteCommands = deletedEntities.flatMap((entity) =>
    buildDestroyMenuItemClientCommand(entity),
  );

  const updateCommands = buildUpdateCommands(newSchema, oldSchema);

  const commands: Command[] = [
    ...createCommands,
    ...deleteCommands,
    ...updateCommands,
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Manage menu items'), ...commands];
}

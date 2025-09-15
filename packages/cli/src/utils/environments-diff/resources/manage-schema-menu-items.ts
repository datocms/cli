import type { CmaClient } from '@datocms/cli-utils';
import {
  cloneDeep,
  difference,
  intersection,
  isEqual,
  omit,
  pick,
  sortBy,
} from 'lodash';
import type {
  Command,
  Schema,
  UpdateSchemaMenuItemClientCommand,
} from '../types';
import { buildSchemaMenuItemTitle, isBase64Id } from '../utils';
import { buildComment } from './comments';

function buildCreateSchemaMenuItemClientCommand(
  schemaMenuItem: CmaClient.RawApiTypes.SchemaMenuItem,
  itemType: CmaClient.RawApiTypes.ItemType | undefined,
): Command[] {
  const attributesToUpdate = omit(schemaMenuItem.attributes, ['position']);

  return [
    buildComment(
      `Create ${buildSchemaMenuItemTitle(schemaMenuItem, itemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.schemaMenuItems.create',
      arguments: [
        {
          data: {
            type: 'schema_menu_item',
            id: isBase64Id(schemaMenuItem.id) ? schemaMenuItem.id : undefined,
            attributes: attributesToUpdate,
            relationships: Object.fromEntries(
              Object.entries(
                omit(schemaMenuItem.relationships, 'children'),
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
  schemaMenuItem: CmaClient.RawApiTypes.SchemaMenuItem,
  itemType: CmaClient.RawApiTypes.ItemType | undefined,
): Command[] {
  return [
    buildComment(
      `Delete ${buildSchemaMenuItemTitle(schemaMenuItem, itemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.schemaMenuItems.destroy',
      arguments: [schemaMenuItem.id],
    },
  ];
}

function buildUpdateSchemaMenuItemClientCommand(
  newSchemaMenuItem: CmaClient.RawApiTypes.SchemaMenuItem,
  oldSchemaMenuItem: CmaClient.RawApiTypes.SchemaMenuItem | undefined,
  newItemType: CmaClient.RawApiTypes.ItemType | undefined,
): Command[] {
  const attributesToUpdate = oldSchemaMenuItem
    ? pick(
        newSchemaMenuItem.attributes,
        (
          Object.keys(newSchemaMenuItem.attributes) as Array<
            keyof CmaClient.RawApiTypes.SchemaMenuItemAttributes
          >
        ).filter(
          (attribute) =>
            !isEqual(
              oldSchemaMenuItem.attributes[attribute],
              newSchemaMenuItem.attributes[attribute],
            ),
        ),
      )
    : pick(newSchemaMenuItem.attributes, 'position');

  const relationshipsToUpdate = oldSchemaMenuItem
    ? pick(
        newSchemaMenuItem.relationships,
        (
          Object.keys(
            omit(newSchemaMenuItem.relationships, 'children'),
          ) as Array<keyof CmaClient.RawApiTypes.SchemaMenuItemRelationships>
        ).filter(
          (attribute) =>
            !isEqual(
              oldSchemaMenuItem.relationships[attribute],
              newSchemaMenuItem.relationships[attribute],
            ),
        ),
      )
    : omit(newSchemaMenuItem.relationships, 'children', 'item_type');

  if (
    Object.keys(attributesToUpdate).length === 0 &&
    (!relationshipsToUpdate || Object.keys(relationshipsToUpdate).length === 0)
  ) {
    return [];
  }

  return [
    buildComment(
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

function findSiblings({
  of: entity,
  collection,
  parentId,
  positionGte,
}: {
  of: CmaClient.RawApiTypes.SchemaMenuItem;
  collection: CmaClient.RawApiTypes.SchemaMenuItem[];
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
  of: CmaClient.RawApiTypes.SchemaMenuItem;
  collection: CmaClient.RawApiTypes.SchemaMenuItem[];
}) {
  return collection.filter(
    (e) => e.relationships.parent.data?.id === entity.id,
  );
}

function findMaxPosition({
  collection,
  parentId,
}: {
  collection: CmaClient.RawApiTypes.SchemaMenuItem[];
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
  oldKeptEntities: CmaClient.RawApiTypes.SchemaMenuItem[];
  createdEntities: CmaClient.RawApiTypes.SchemaMenuItem[];
  deletedEntities: CmaClient.RawApiTypes.SchemaMenuItem[];
}) {
  const state = oldKeptEntities.map(cloneDeep);

  createdEntities.forEach((entity) => {
    const newEntity = cloneDeep(entity);

    newEntity.relationships.parent.data = null;

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
  updateCommand: UpdateSchemaMenuItemClientCommand;
  state: CmaClient.RawApiTypes.SchemaMenuItem[];
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
    ? { id: entityParentIdAfterUpdate, type: 'schema_menu_item' }
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
  state: CmaClient.RawApiTypes.SchemaMenuItem[],
  newSchema: Schema,
  rawRoots: CmaClient.RawApiTypes.SchemaMenuItem[] = state.filter(
    (entity) => !entity.relationships.parent.data,
  ),
  level = 0,
) {
  if (message) {
    console.log(`\n\n${message}`);
  }

  const roots = sortBy(rawRoots, (e) => e.attributes.position);

  roots.forEach((root) => {
    const itemType = root.relationships.item_type.data
      ? newSchema.itemTypesById[root.relationships.item_type.data.id].entity
      : undefined;

    console.log(
      `${'  '.repeat(level)}${
        root.attributes.position
      }. ${buildSchemaMenuItemTitle(root, itemType)} (${root.id})`,
    );

    debugState(
      '',
      state,
      newSchema,
      state.filter(
        (entity) => entity.relationships.parent.data?.id === root.id,
      ),
      level + 1,
    );
  });
}

function buildUpdateCommands(newSchema: Schema, oldSchema: Schema) {
  const oldEntityIds = Object.keys(oldSchema.schemaMenuItemsById);

  const newEntityIds = Object.keys(newSchema.schemaMenuItemsById);

  const oldKeptEntities = intersection(oldEntityIds, newEntityIds).map(
    (schemaMenuItemId) => oldSchema.schemaMenuItemsById[schemaMenuItemId],
  );

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (schemaMenuItemId) => oldSchema.schemaMenuItemsById[schemaMenuItemId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (schemaMenuItemId) => newSchema.schemaMenuItemsById[schemaMenuItemId],
  );

  function run(mode: 'smart' | 'dumb') {
    const state = generateInitialState({
      oldKeptEntities,
      deletedEntities,
      createdEntities,
    });

    // debugState(`INITIAL (${mode})`, state, newSchema);

    const sortedEntitiesToProcess = sortBy(
      newEntityIds.map(
        (schemaMenuItemId) => newSchema.schemaMenuItemsById[schemaMenuItemId],
      ),
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

    let commands: Command[] = [];

    while (sortedEntitiesToProcess.length > 0) {
      const entityToProcess = sortedEntitiesToProcess.shift()!;
      const itemType = entityToProcess.relationships.item_type.data
        ? newSchema.itemTypesById[
            entityToProcess.relationships.item_type.data.id
          ].entity
        : undefined;

      const entityInState = state.find(
        (e) => e.id === entityToProcess.id && e.type === entityToProcess.type,
      )!;

      const entityCommands = buildUpdateSchemaMenuItemClientCommand(
        entityToProcess,
        entityInState,
        itemType,
      );

      commands = [...commands, ...entityCommands];

      // console.log(
      //   `\nProcesso ${buildSchemaMenuItemTitle(entityToProcess, itemType)}`,
      // );

      entityCommands
        .filter(
          (c): c is UpdateSchemaMenuItemClientCommand =>
            c.type === 'apiCallClientCommand' &&
            c.call === 'client.schemaMenuItems.update',
        )
        .forEach((updateCommand) =>
          updateState({
            updateCommand,
            state,
          }),
        );

      // if (entityCommands.length > 0) {
      //   debugState(`RESULT (${mode})`, state, newSchema);
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

function sortByDepth(entities: CmaClient.RawApiTypes.SchemaMenuItem[]) {
  type Node = {
    entity: CmaClient.RawApiTypes.SchemaMenuItem;
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

  const createCommands = sortByDepth(createdEntities).flatMap((entity) =>
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

  const updateCommands = buildUpdateCommands(newSchema, oldSchema);

  const commands: Command[] = [
    ...createCommands,
    ...deleteCommands,
    ...updateCommands,
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Manage schema menu items'), ...commands];
}

import {
  cloneDeep,
  difference,
  intersection,
  isEqual,
  pick,
  sortBy,
  update,
  without,
} from 'lodash';
import { CmaClient } from '@datocms/cli-utils';
import {
  Command,
  ItemTypeInfo,
  Schema,
  UpdateFieldClientCommand,
  UpdateFieldsetClientCommand,
} from '../types';
import {
  buildFieldsetTitle,
  buildFieldTitle,
  buildItemTypeTitle,
} from '../utils';
import { buildComment } from './comments';

export function buildRegularUpdateFieldClientCommand(
  newField: CmaClient.SchemaTypes.Field,
  oldField: CmaClient.SchemaTypes.Field | undefined,
): Command | undefined {
  const attributesToUpdate = oldField
    ? pick(
        newField.attributes,
        without(
          (
            Object.keys(newField.attributes) as Array<
              keyof CmaClient.SchemaTypes.FieldAttributes
            >
          ).filter(
            (attribute) =>
              !isEqual(
                oldField.attributes[attribute],
                newField.attributes[attribute],
              ),
          ),
          'appeareance',
          'field_type',
        ),
      )
    : pick(newField.attributes, 'position');

  const relationshipsToUpdate = oldField
    ? pick(
        newField.relationships,
        (
          Object.keys(newField.relationships) as Array<
            keyof CmaClient.SchemaTypes.FieldRelationships
          >
        ).filter(
          (attribute) =>
            !isEqual(
              oldField.relationships[attribute],
              newField.relationships[attribute],
            ),
        ),
      )
    : null;

  if (
    Object.keys(attributesToUpdate).length === 0 &&
    (!relationshipsToUpdate || Object.keys(relationshipsToUpdate).length === 0)
  ) {
    return undefined;
  }

  return {
    type: 'apiCallClientCommand',
    call: 'client.fields.update',
    arguments: [
      newField.id,
      {
        data: {
          id: newField.id,
          type: 'field',
          attributes: attributesToUpdate,
          ...(relationshipsToUpdate &&
          Object.keys(relationshipsToUpdate).length > 0
            ? { relationships: relationshipsToUpdate }
            : {}),
        },
      },
    ],
    fieldType: newField.attributes.field_type,
  };
}

export function buildUpdateFieldClientCommand(
  newField: CmaClient.SchemaTypes.Field,
  oldField: CmaClient.SchemaTypes.Field | undefined,
  itemType: CmaClient.SchemaTypes.ItemType,
): Command[] {
  const commands: Command[] = [];

  if (
    oldField &&
    newField.attributes.field_type !== oldField.attributes.field_type
  ) {
    commands.push({
      type: 'apiCallClientCommand',
      call: 'client.fields.update',
      arguments: [
        newField.id,
        {
          data: {
            id: newField.id,
            type: 'field',
            attributes: {
              field_type: newField.attributes.field_type,
            },
          },
        },
      ],
      fieldType: newField.attributes.field_type,
    });
  }

  const regularUpdateFieldClientCommand = buildRegularUpdateFieldClientCommand(
    newField,
    oldField,
  );

  if (regularUpdateFieldClientCommand) {
    commands.push(regularUpdateFieldClientCommand);
  }

  if (commands.length === 0) {
    return [];
  }

  return [
    buildComment(
      `Update ${buildFieldTitle(newField)} in ${buildItemTypeTitle(itemType)}`,
    ),
    ...commands,
  ];
}

export function buildUpdateFieldsetClientCommand(
  newFieldset: CmaClient.SchemaTypes.Fieldset,
  oldFieldset: CmaClient.SchemaTypes.Fieldset | undefined,
  itemType: CmaClient.SchemaTypes.ItemType,
): Command[] {
  const attributesToUpdate = oldFieldset
    ? pick(
        newFieldset.attributes,
        (
          Object.keys(newFieldset.attributes) as Array<
            keyof CmaClient.SchemaTypes.FieldsetAttributes
          >
        ).filter(
          (attribute) =>
            !isEqual(
              oldFieldset.attributes[attribute],
              newFieldset.attributes[attribute],
            ),
        ),
      )
    : pick(newFieldset.attributes, 'position');

  if (Object.keys(attributesToUpdate).length === 0) {
    return [];
  }

  return [
    buildComment(
      `Update ${buildFieldsetTitle(newFieldset)} in ${buildItemTypeTitle(
        itemType,
      )}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.fieldsets.update',
      arguments: [
        newFieldset.id,
        {
          data: {
            id: newFieldset.id,
            type: 'fieldset',
            attributes: attributesToUpdate,
          },
        },
      ],
    },
  ];
}

function getFieldsetId(
  entity: CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset,
) {
  return entity.type === 'field'
    ? entity.relationships.fieldset.data?.id
    : undefined;
}

function findSiblings({
  of: entity,
  collection,
  fieldsetId,
  positionGte,
}: {
  of: CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset;
  collection: Array<
    CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset
  >;
  fieldsetId: string | undefined;
  positionGte: number;
}) {
  const siblings = fieldsetId
    ? collection.filter(
        (entity) =>
          entity.type === 'field' &&
          entity.relationships.fieldset.data?.id == fieldsetId,
      )
    : collection.filter(
        (entity) =>
          (entity.type === 'field' && !entity.relationships.fieldset.data) ||
          entity.type === 'fieldset',
      );

  return siblings
    .filter((e) => e.id !== entity.id || e.type !== entity.type)
    .filter((e) => e.attributes.position >= positionGte);
}

function findChildren({
  of: entity,
  collection,
}: {
  of: CmaClient.SchemaTypes.Fieldset;
  collection: Array<
    CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset
  >;
}) {
  return collection.filter(
    (e): e is CmaClient.SchemaTypes.Field =>
      e.type === 'field' && e.relationships.fieldset.data?.id === entity.id,
  );
}

function findMaxPosition({
  collection,
  fieldsetId,
}: {
  collection: Array<
    CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset
  >;
  fieldsetId: string | undefined;
}) {
  const siblings = fieldsetId
    ? collection.filter(
        (entity) =>
          entity.type === 'field' &&
          entity.relationships.fieldset.data?.id == fieldsetId,
      )
    : collection.filter(
        (entity) =>
          (entity.type === 'field' && !entity.relationships.fieldset.data) ||
          entity.type === 'fieldset',
      );

  return siblings.reduce((max, e) => Math.max(max, e.attributes.position), 0);
}

function generateInitialState({
  oldKeptEntities,
  createdEntities,
  deletedEntities,
}: {
  oldKeptEntities: Array<
    CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset
  >;
  createdEntities: Array<
    CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset
  >;
  deletedEntities: Array<
    CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset
  >;
}) {
  const state = oldKeptEntities.map(cloneDeep);

  createdEntities.forEach((entity) => {
    const newEntity = cloneDeep(entity);

    newEntity.attributes.position =
      findMaxPosition({
        collection: state,
        fieldsetId:
          entity.type === 'field'
            ? entity.relationships.fieldset.data?.id
            : undefined,
      }) + 1;

    state.push(newEntity);
  });

  deletedEntities.forEach((deletedEntity) => {
    findSiblings({
      of: deletedEntity,
      collection: state,
      fieldsetId: getFieldsetId(deletedEntity),
      positionGte: deletedEntity.attributes.position,
    }).forEach((entity) => {
      entity.attributes.position -= 1;
    });

    if (deletedEntity.type === 'fieldset') {
      findChildren({ of: deletedEntity, collection: state }).forEach(
        (entityInState) => {
          entityInState.relationships.fieldset.data = null;
          entityInState.attributes.position =
            findMaxPosition({
              collection: state,
              fieldsetId: undefined,
            }) + 1;
        },
      );
    }
  });

  return state;
}

function debugState(
  message: string,
  state: Array<CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset>,
) {
  console.log(message);

  const roots = sortBy(
    state.filter(
      (entity) =>
        (entity.type === 'field' && !entity.relationships.fieldset.data) ||
        entity.type === 'fieldset',
    ),
    (e) => e.attributes.position,
  );

  roots.forEach((root) => {
    console.log(
      `${root.attributes.position}. ${
        root.type === 'field' ? root.attributes.api_key : root.attributes.title
      }`,
    );

    if (root.type === 'fieldset') {
      const children = sortBy(
        state.filter(
          (entity) =>
            entity.type === 'field' &&
            entity.relationships.fieldset.data?.id === root.id,
        ),
        (e) => e.attributes.position,
      );

      children.forEach((root) => {
        console.log(
          `  ${root.attributes.position}. ${
            root.type === 'field'
              ? root.attributes.api_key
              : root.attributes.title
          }`,
        );
      });
    }
  });
}

class InvalidMovement extends Error {}

function updateState({
  updateCommand,
  state,
}: {
  updateCommand: UpdateFieldsetClientCommand | UpdateFieldClientCommand;
  state: Array<CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset>;
}) {
  const entityType =
    updateCommand.call === 'client.fields.update' ? 'field' : 'fieldset';

  const entityId = updateCommand.arguments[0];

  const entityInState = state.find(
    (e) => e.id === entityId && e.type === entityType,
  )!;

  const entityFieldsetIdBeforeUpdate = getFieldsetId(entityInState);

  const entityPositionBeforeUpdate = entityInState.attributes.position;

  const entityFieldsetIdAfterUpdate =
    updateCommand.call === 'client.fields.update'
      ? updateCommand.arguments[1].data.relationships?.fieldset
        ? updateCommand.arguments[1].data.relationships?.fieldset.data?.id
        : entityFieldsetIdBeforeUpdate
      : undefined;

  const entityPositionAfterUpdate =
    'position' in updateCommand.arguments[1].data.attributes
      ? updateCommand.arguments[1].data.attributes.position!
      : entityPositionBeforeUpdate;

  const maxPosition = findMaxPosition({
    collection: findSiblings({
      of: entityInState,
      collection: state,
      fieldsetId: entityFieldsetIdAfterUpdate,
      positionGte: 0,
    }),
    fieldsetId: entityFieldsetIdAfterUpdate,
  });

  if (entityPositionAfterUpdate > maxPosition + 1) {
    throw new InvalidMovement('Something went wrong!');
  }

  entityInState.attributes.position = entityPositionAfterUpdate;

  if (entityInState.type === 'field') {
    entityInState.relationships.fieldset.data = entityFieldsetIdAfterUpdate
      ? { id: entityFieldsetIdAfterUpdate, type: 'fieldset' }
      : null;
  }

  findSiblings({
    of: entityInState,
    collection: state,
    fieldsetId: entityFieldsetIdBeforeUpdate,
    positionGte: entityPositionBeforeUpdate,
  }).forEach((entity) => {
    entity.attributes.position -= 1;
  });

  findSiblings({
    of: entityInState,
    collection: state,
    fieldsetId: entityFieldsetIdAfterUpdate,
    positionGte: entityPositionAfterUpdate,
  }).forEach((entity) => {
    entity.attributes.position += 1;
  });
}

export function updateFieldsAndFieldsetsInItemType(
  newItemTypeSchema: ItemTypeInfo,
  oldItemTypeSchema: ItemTypeInfo,
): Command[] {
  const oldFieldIds = Object.keys(oldItemTypeSchema.fieldsById);
  const newFieldIds = Object.keys(newItemTypeSchema.fieldsById);

  const oldFieldsetIds = Object.keys(oldItemTypeSchema.fieldsetsById);
  const newFieldsetIds = Object.keys(newItemTypeSchema.fieldsetsById);

  const oldKeptEntities = sortBy(
    [
      ...intersection(oldFieldIds, newFieldIds).map(
        (fieldId) => oldItemTypeSchema.fieldsById[fieldId],
      ),
      ...intersection(oldFieldsetIds, newFieldsetIds).map(
        (fieldsetId) => oldItemTypeSchema.fieldsetsById[fieldsetId],
      ),
    ],
    (entity) => entity.attributes.position,
  );

  const deletedEntities = sortBy(
    [
      ...difference(oldFieldIds, newFieldIds).map(
        (fieldId) => oldItemTypeSchema.fieldsById[fieldId],
      ),
      ...difference(oldFieldsetIds, newFieldsetIds).map(
        (fieldsetId) => oldItemTypeSchema.fieldsetsById[fieldsetId],
      ),
    ],
    (entity) => entity.attributes.position,
  );

  const createdEntities = sortBy(
    [
      ...difference(newFieldIds, oldFieldIds).map(
        (fieldId) => newItemTypeSchema.fieldsById[fieldId],
      ),
      ...difference(newFieldsetIds, oldFieldsetIds).map(
        (fieldsetId) => newItemTypeSchema.fieldsetsById[fieldsetId],
      ),
    ],
    (entity) => entity.attributes.position,
  );

  function run(mode: 'smart' | 'dumb') {
    const state = generateInitialState({
      oldKeptEntities,
      deletedEntities,
      createdEntities,
    });

    const sortedEntitiesToProcess = sortBy(
      [
        ...newFieldIds.map((fieldId) => newItemTypeSchema.fieldsById[fieldId]),
        ...newFieldsetIds.map(
          (fieldsetId) => newItemTypeSchema.fieldsetsById[fieldsetId],
        ),
      ],
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
          entityInState.type === 'field' &&
          entity.type === 'field' &&
          entityInState.relationships.fieldset.data?.id !==
            entity.relationships.fieldset.data?.id
        ) {
          weight += 100;
        }

        return -weight;
      },
    );

    // if (newItemTypeSchema.entity.attributes.api_key === 'plugin') {
    //   debugState('INITIAL', state);
    // }

    let commands: Command[] = [];

    while (sortedEntitiesToProcess.length > 0) {
      const entityToProcess = sortedEntitiesToProcess.shift()!;
      const entityInState = state.find(
        (e) => e.id === entityToProcess.id && e.type === entityToProcess.type,
      )!;

      const entityCommands =
        entityToProcess.type === 'field'
          ? buildUpdateFieldClientCommand(
              entityToProcess,
              entityInState as CmaClient.SchemaTypes.Field,
              newItemTypeSchema.entity,
            )
          : buildUpdateFieldsetClientCommand(
              entityToProcess,
              entityInState as CmaClient.SchemaTypes.Fieldset,
              newItemTypeSchema.entity,
            );

      commands = [...commands, ...entityCommands];

      // if (
      //   newItemTypeSchema.entity.attributes.api_key === 'plugin' &&
      //   entityCommands.length > 0
      // ) {
      //   console.log(
      //     `${entityToProcess.type} ${
      //       entityToProcess.type === 'field'
      //         ? entityToProcess.attributes.api_key
      //         : entityToProcess.attributes.title
      //     }`,
      //   );
      // }

      entityCommands
        .filter(
          (c): c is UpdateFieldsetClientCommand | UpdateFieldClientCommand =>
            c.type === 'apiCallClientCommand' &&
            ['client.fieldsets.update', 'client.fields.update'].includes(
              c.call,
            ),
        )
        .forEach((updateCommand) =>
          updateState({
            updateCommand,
            state,
          }),
        );

      // if (
      //   newItemTypeSchema.entity.attributes.api_key === 'plugin' &&
      //   entityCommands.length > 0
      // ) {
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

export function updateFieldsAndFieldsets(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const keptItemTypeIds = intersection(newItemTypeIds, oldItemTypeIds);

  const commands = keptItemTypeIds
    .map((itemTypeId) =>
      updateFieldsAndFieldsetsInItemType(
        newSchema.itemTypesById[itemTypeId],
        oldSchema.itemTypesById[itemTypeId],
      ),
    )
    .flat();

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Update existing fields/fieldsets'), ...commands];
}

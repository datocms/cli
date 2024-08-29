import type { CmaClient } from '@datocms/cli-utils';
import {
  difference,
  intersection,
  isEqual,
  pick,
  sortBy,
  without,
} from 'lodash';
import type { Command, ItemTypeInfo, Schema } from '../types';
import {
  buildFieldTitle,
  buildFieldsetTitle,
  buildItemTypeTitle,
} from '../utils';
import { buildLog } from './comments';

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
          'position',
        ),
      )
    : pick(newField.attributes, 'position');

  const relationshipsToUpdate = oldField
    ? pick(
        newField.relationships,
        without(
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
          'fieldset',
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
  oldField: CmaClient.SchemaTypes.Field,
  itemType: CmaClient.SchemaTypes.ItemType,
): Command[] {
  const commands: Command[] = [];

  if (newField.attributes.field_type !== oldField.attributes.field_type) {
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
    buildLog(
      `Update ${buildFieldTitle(newField)} in ${buildItemTypeTitle(itemType)}`,
    ),
    ...commands,
  ];
}

export function buildUpdateFieldsetClientCommand(
  newFieldset: CmaClient.SchemaTypes.Fieldset,
  oldFieldset: CmaClient.SchemaTypes.Fieldset,
  itemType: CmaClient.SchemaTypes.ItemType,
): Command[] {
  const attributesToUpdate = pick(
    newFieldset.attributes,
    without(
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
      'position',
    ),
  );

  if (Object.keys(attributesToUpdate).length === 0) {
    return [];
  }

  return [
    buildLog(
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

type Entity = CmaClient.SchemaTypes.Field | CmaClient.SchemaTypes.Fieldset;

function isField(entity: Entity): entity is CmaClient.SchemaTypes.Field {
  return entity.type === 'field';
}

function isFieldset(entity: Entity): entity is CmaClient.SchemaTypes.Fieldset {
  return entity.type === 'fieldset';
}

function buildReorderClientCommand(
  keptEntities: Array<
    | [CmaClient.SchemaTypes.Field, CmaClient.SchemaTypes.Field]
    | [CmaClient.SchemaTypes.Fieldset, CmaClient.SchemaTypes.Fieldset]
  >,
  newEntities: Entity[],
  itemType: CmaClient.SchemaTypes.ItemType,
): Command[] {
  const commands: CmaClient.SchemaTypes.ItemTypeReorderFieldsAndFieldsetsSchema['data'] =
    [
      ...newEntities,
      ...keptEntities
        .filter(([newEntity, oldEntity]) =>
          isField(newEntity) && isField(oldEntity)
            ? !isEqual(
                newEntity.attributes.position,
                oldEntity.attributes.position,
              ) ||
              !isEqual(
                newEntity.relationships.fieldset.data?.id,
                oldEntity.relationships.fieldset.data?.id,
              )
            : isFieldset(newEntity) && isFieldset(oldEntity)
              ? !isEqual(
                  newEntity.attributes.position,
                  oldEntity.attributes.position,
                )
              : true,
        )
        .map((tuple) => tuple[0]),
    ].map((entity) =>
      isField(entity)
        ? {
            id: entity.id,
            type: entity.type,
            attributes: { position: entity.attributes.position },
            relationships: {
              fieldset: {
                data: entity.relationships.fieldset.data?.id
                  ? {
                      id: entity.relationships.fieldset.data.id,
                      type: 'fieldset',
                    }
                  : null,
              },
            },
          }
        : {
            id: entity.id,
            type: entity.type,
            attributes: { position: entity.attributes.position },
          },
    );

  if (commands.length === 0) {
    return [];
  }

  return [
    buildLog(`Reorder fields/fieldsets for ${buildItemTypeTitle(itemType)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.itemTypes.rawReorderFieldsAndFieldsets',
      arguments: [
        {
          data: commands,
        },
      ],
    },
  ];
}

function updateFieldsAndFieldsetsInItemType(
  newItemTypeSchema: ItemTypeInfo,
  oldItemTypeSchema: ItemTypeInfo,
): Command[] {
  const oldFieldIds = Object.keys(oldItemTypeSchema.fieldsById);
  const newFieldIds = Object.keys(newItemTypeSchema.fieldsById);

  const oldFieldsetIds = Object.keys(oldItemTypeSchema.fieldsetsById);
  const newFieldsetIds = Object.keys(newItemTypeSchema.fieldsetsById);

  const keptEntities = [
    ...intersection(oldFieldIds, newFieldIds).map(
      (fieldId) =>
        [
          newItemTypeSchema.fieldsById[fieldId],
          oldItemTypeSchema.fieldsById[fieldId],
        ] as [CmaClient.SchemaTypes.Field, CmaClient.SchemaTypes.Field],
    ),
    ...intersection(oldFieldsetIds, newFieldsetIds).map(
      (fieldsetId) =>
        [
          newItemTypeSchema.fieldsetsById[fieldsetId],
          oldItemTypeSchema.fieldsetsById[fieldsetId],
        ] as [CmaClient.SchemaTypes.Fieldset, CmaClient.SchemaTypes.Fieldset],
    ),
  ];

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

  const updateCommands = keptEntities.flatMap(([newEntity, oldEntity]) =>
    newEntity.type === 'field'
      ? buildUpdateFieldClientCommand(
          newEntity,
          oldEntity as CmaClient.SchemaTypes.Field,
          newItemTypeSchema.entity,
        )
      : buildUpdateFieldsetClientCommand(
          newEntity,
          oldEntity as CmaClient.SchemaTypes.Fieldset,
          newItemTypeSchema.entity,
        ),
  );

  const reorderCommands = buildReorderClientCommand(
    keptEntities,
    createdEntities,
    newItemTypeSchema.entity,
  );

  return [...updateCommands, ...reorderCommands];
}

export function updateFieldsAndFieldsets(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const keptItemTypes = intersection(oldItemTypeIds, newItemTypeIds).map(
    (id) =>
      [newSchema.itemTypesById[id], oldSchema.itemTypesById[id]] as [
        ItemTypeInfo,
        ItemTypeInfo,
      ],
  );

  const commands = keptItemTypes.flatMap((keptItemType) =>
    updateFieldsAndFieldsetsInItemType(...keptItemType),
  );

  if (commands.length === 0) {
    return [];
  }

  return [buildLog('Update existing fields/fieldsets'), ...commands];
}

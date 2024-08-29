import type { CmaClient } from '@datocms/cli-utils';
import { difference, intersection, isEqual, omit, pick, without } from 'lodash';
import type {
  Command,
  ReorderUploadCollectionsClientCommand,
  Schema,
} from '../types';
import { buildUploadCollectionTitle, isBase64Id } from '../utils';
import { buildReorderCommand } from './build-reorder-command';
import { buildLog } from './comments';

function buildCreateUploadCollectionClientCommand(
  uploadCollection: CmaClient.SchemaTypes.UploadCollection,
): Command[] {
  const attributesToPick = Object.keys(uploadCollection.attributes) as Array<
    keyof CmaClient.SchemaTypes.UploadCollectionAttributes
  >;

  const attributes = pick(
    uploadCollection.attributes,
    without(attributesToPick, 'position'),
  );

  return [
    buildLog(`Create ${buildUploadCollectionTitle(uploadCollection)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.uploadCollections.create',
      arguments: [
        {
          data: {
            type: 'upload_collection',
            id: isBase64Id(uploadCollection.id)
              ? uploadCollection.id
              : undefined,
            attributes: attributes,
          },
        },
      ],
      oldEnvironmentId: uploadCollection.id,
    },
  ];
}

function buildDestroyUploadCollectionClientCommand(
  uploadCollection: CmaClient.SchemaTypes.UploadCollection,
): Command[] {
  return [
    buildLog(`Delete ${buildUploadCollectionTitle(uploadCollection)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.uploadCollections.destroy',
      arguments: [uploadCollection.id],
    },
  ];
}

function buildUpdateUploadCollectionClientCommand(
  newUploadCollection: CmaClient.SchemaTypes.UploadCollection,
  oldUploadCollection: CmaClient.SchemaTypes.UploadCollection,
): Command[] {
  const attributesToUpdate = pick(
    newUploadCollection.attributes,
    (
      Object.keys(omit(newUploadCollection.attributes, ['position'])) as Array<
        keyof CmaClient.SchemaTypes.UploadCollectionAttributes
      >
    ).filter(
      (attribute) =>
        !isEqual(
          oldUploadCollection.attributes[attribute],
          newUploadCollection.attributes[attribute],
        ),
    ),
  );

  const relationshipsToUpdate = pick(
    newUploadCollection.relationships,
    (
      Object.keys(
        omit(newUploadCollection.relationships, ['children', 'parent']),
      ) as Array<keyof CmaClient.SchemaTypes.UploadCollectionRelationships>
    ).filter(
      (relationship) =>
        relationship !== 'parent' &&
        !isEqual(
          oldUploadCollection.relationships[relationship],
          newUploadCollection.relationships[relationship],
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
    buildLog(`Update ${buildUploadCollectionTitle(newUploadCollection)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.uploadCollections.update',
      arguments: [
        newUploadCollection.id,
        {
          data: {
            type: 'upload_collection',
            id: newUploadCollection.id,
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

export function manageUploadCollections(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const oldEntityIds = Object.keys(oldSchema.uploadCollectionsById);
  const newEntityIds = Object.keys(newSchema.uploadCollectionsById);

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (uploadCollectionId) => oldSchema.uploadCollectionsById[uploadCollectionId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (uploadCollectionId) => newSchema.uploadCollectionsById[uploadCollectionId],
  );

  const keptEntities = intersection(oldEntityIds, newEntityIds).map(
    (id) =>
      [
        newSchema.uploadCollectionsById[id],
        oldSchema.uploadCollectionsById[id],
      ] as [
        CmaClient.SchemaTypes.UploadCollection,
        CmaClient.SchemaTypes.UploadCollection,
      ],
  );

  const createCommands = createdEntities.flatMap((entity) =>
    buildCreateUploadCollectionClientCommand(entity),
  );

  const deleteCommands = deletedEntities.flatMap((entity) =>
    buildDestroyUploadCollectionClientCommand(entity),
  );

  const updateCommands = keptEntities.flatMap(([newEntity, oldEntity]) =>
    buildUpdateUploadCollectionClientCommand(newEntity, oldEntity),
  );

  const reorderCommands = buildReorderCommand<
    'upload_collection',
    ReorderUploadCollectionsClientCommand
  >('client.uploadCollections.reorder', keptEntities, createdEntities);

  const commands: Command[] = [
    ...createCommands,
    ...deleteCommands,
    ...updateCommands,
    ...reorderCommands,
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildLog('Manage upload collections'), ...commands];
}

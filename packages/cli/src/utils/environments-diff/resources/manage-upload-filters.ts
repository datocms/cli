import { difference, intersection, isEqual, pick } from 'lodash';
import { CmaClient } from '@datocms/cli-utils';
import { Command, Schema } from '../types';
import { buildUploadFilterTitle } from '../utils';
import { buildComment } from './comments';

function buildCreateUploadFilterClientCommand(
  uploadFilter: CmaClient.SchemaTypes.UploadFilter,
): Command[] {
  return [
    buildComment(`Create ${buildUploadFilterTitle(uploadFilter)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.uploadFilters.create',
      arguments: [
        {
          data: {
            type: 'upload_filter',
            attributes: uploadFilter.attributes,
          },
        },
      ],
      oldEnvironmentId: uploadFilter.id,
    },
  ];
}

function buildDestroyUploadFilterClientCommand(
  uploadFilter: CmaClient.SchemaTypes.UploadFilter,
): Command[] {
  return [
    buildComment(`Delete ${buildUploadFilterTitle(uploadFilter)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.uploadFilters.destroy',
      arguments: [uploadFilter.id],
    },
  ];
}

function buildUpdateUploadFilterClientCommand(
  newUploadFilter: CmaClient.SchemaTypes.UploadFilter,
  oldUploadFilter: CmaClient.SchemaTypes.UploadFilter,
): Command[] {
  const updatedAttributes = (
    Object.keys(newUploadFilter.attributes) as Array<
      keyof CmaClient.SchemaTypes.UploadFilterAttributes
    >
  ).filter(
    (attribute) =>
      !isEqual(
        oldUploadFilter.attributes[attribute],
        newUploadFilter.attributes[attribute],
      ),
  );

  if (updatedAttributes.length === 0) {
    return [];
  }

  return [
    buildComment(`Update ${buildUploadFilterTitle(newUploadFilter)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.uploadFilters.update',
      arguments: [
        oldUploadFilter.id,
        {
          data: {
            type: 'upload_filter',
            id: oldUploadFilter.id,

            attributes: newUploadFilter.attributes,
          },
        },
      ],
    },
  ];
}

export function manageUploadFilters(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const oldEntityIds = Object.keys(oldSchema.uploadFiltersById);
  const newEntityIds = Object.keys(newSchema.uploadFiltersById);

  const keptEntityIds = intersection(oldEntityIds, newEntityIds);

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (uploadFilterId) => oldSchema.uploadFiltersById[uploadFilterId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (uploadFilterId) => newSchema.uploadFiltersById[uploadFilterId],
  );

  const commands: Command[] = [
    ...createdEntities.map(buildCreateUploadFilterClientCommand).flat(),
    ...deletedEntities.map(buildDestroyUploadFilterClientCommand).flat(),
    ...keptEntityIds
      .map((uploadFilterId) =>
        buildUpdateUploadFilterClientCommand(
          newSchema.uploadFiltersById[uploadFilterId],
          oldSchema.uploadFiltersById[uploadFilterId],
        ),
      )
      .flat(),
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Manage upload filters'), ...commands];
}

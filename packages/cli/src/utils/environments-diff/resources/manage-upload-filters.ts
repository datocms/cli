import type { CmaClient } from '@datocms/cli-utils';
import { difference, intersection, isEqual } from 'lodash';
import type { Command, Schema } from '../types';
import { buildUploadFilterTitle, isBase64Id } from '../utils';
import { buildComment } from './comments';

function buildCreateUploadFilterClientCommand(
  uploadFilter: CmaClient.RawApiTypes.UploadFilter,
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
            id: isBase64Id(uploadFilter.id) ? uploadFilter.id : undefined,
            attributes: uploadFilter.attributes,
          },
        },
      ],
      oldEnvironmentId: uploadFilter.id,
    },
  ];
}

function buildDestroyUploadFilterClientCommand(
  uploadFilter: CmaClient.RawApiTypes.UploadFilter,
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
  newUploadFilter: CmaClient.RawApiTypes.UploadFilter,
  oldUploadFilter: CmaClient.RawApiTypes.UploadFilter,
): Command[] {
  const updatedAttributes = (
    Object.keys(newUploadFilter.attributes) as Array<
      keyof CmaClient.RawApiTypes.UploadFilterAttributes
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
    ...deletedEntities.flatMap(buildDestroyUploadFilterClientCommand),
    ...createdEntities.flatMap(buildCreateUploadFilterClientCommand),
    ...keptEntityIds.flatMap((uploadFilterId) =>
      buildUpdateUploadFilterClientCommand(
        newSchema.uploadFiltersById[uploadFilterId],
        oldSchema.uploadFiltersById[uploadFilterId],
      ),
    ),
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Manage upload filters'), ...commands];
}

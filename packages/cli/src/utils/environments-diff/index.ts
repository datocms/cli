import type { CmaClient } from '@datocms/cli-utils';
import { resolveConfig } from 'prettier';
import { fetchSchema } from './fetch-schema';
import { createNewFieldsAndFieldsets } from './resources/create-new-fields-and-fieldsets';
import { createNewItemTypes } from './resources/create-new-item-types';
import { deleteMissingFieldsAndFieldsetsInExistingItemTypes } from './resources/delete-missing-fields-and-fieldsets-in-existing-item-types';
import { deleteMissingItemTypes } from './resources/delete-missing-item-types';
import { finalizeItemTypes } from './resources/finalize-item-types';
import { manageItemTypeFilters } from './resources/manage-item-type-filters';
import { manageMenuItems } from './resources/manage-menu-items';
import { managePlugins } from './resources/manage-plugins';
import { manageSchemaMenuItems } from './resources/manage-schema-menu-items';
import { manageUploadFilters } from './resources/manage-upload-filters';
import { manageWorkflows } from './resources/manage-workflows';
import { updateFieldsAndFieldsets } from './resources/update-fields-and-fieldsets';
import { updateRoles } from './resources/update-roles';
import { updateSite } from './resources/update-site';
import { write } from './write';

export async function diffEnvironments({
  newClient,
  newEnvironmentId,
  oldClient,
  oldEnvironmentId,
  migrationFilePath,
  format,
}: {
  newClient: CmaClient.Client;
  newEnvironmentId: string;
  oldClient: CmaClient.Client;
  oldEnvironmentId: string;
  migrationFilePath: string;
  format: 'js' | 'ts';
}) {
  const newSchema = await fetchSchema(newClient);
  const oldSchema = await fetchSchema(oldClient);

  const { data: roles } = await newClient.roles.rawList();

  const commands = [
    ...updateSite(newSchema, oldSchema),
    ...manageWorkflows(newSchema, oldSchema),
    ...managePlugins(newSchema, oldSchema),
    ...manageUploadFilters(newSchema, oldSchema),
    ...createNewItemTypes(newSchema, oldSchema),
    ...createNewFieldsAndFieldsets(newSchema, oldSchema),
    ...deleteMissingFieldsAndFieldsetsInExistingItemTypes(newSchema, oldSchema),
    ...updateFieldsAndFieldsets(newSchema, oldSchema),
    ...deleteMissingItemTypes(newSchema, oldSchema),
    ...finalizeItemTypes(newSchema, oldSchema),
    ...manageItemTypeFilters(newSchema, oldSchema),
    ...manageMenuItems(newSchema, oldSchema),
    ...manageSchemaMenuItems(newSchema, oldSchema),
    ...updateRoles(roles, newEnvironmentId, oldEnvironmentId),
  ];

  try {
    const options = await resolveConfig(migrationFilePath);
    return write(commands, { ...options, format, filepath: migrationFilePath });
  } catch {
    // .prettierrc of user might not work with our version of prettier, in this case
    // fall back to default options
    return write(commands, { format, filepath: migrationFilePath });
  }
}

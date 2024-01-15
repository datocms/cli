import { CmaClient } from '@datocms/cli-utils';
import { Schema } from './types';

export async function fetchSchema(client: CmaClient.Client): Promise<Schema> {
  const [
    siteResponse,
    menuItemsResponse,
    schemaMenuItemsResponse,
    pluginsResponse,
    workflowsResponse,
    itemTypeFiltersResponse,
    uploadFiltersResponse,
  ] = await Promise.all([
    client.site.rawFind({
      include: 'item_types,item_types.fields,item_types.fieldsets',
    }),
    client.menuItems.rawList(),
    client.schemaMenuItems.rawList(),
    client.plugins.rawList(),
    client.workflows.rawList(),
    client.itemTypeFilters.rawList(),
    client.uploadFilters.rawList(),
  ]);

  const includedResources = siteResponse.included || [];

  const allFields = includedResources.filter(
    (x): x is CmaClient.SchemaTypes.Field => x.type === 'field',
  );

  const allFieldsets: CmaClient.SchemaTypes.Fieldset[] =
    includedResources.filter(
      (x): x is CmaClient.SchemaTypes.Fieldset => x.type === 'fieldset',
    );

  return {
    siteEntity: siteResponse.data,
    itemTypesById: Object.fromEntries(
      includedResources
        .filter(
          (x): x is CmaClient.SchemaTypes.ItemType => x.type === 'item_type',
        )
        .map((itemType) => [
          itemType.id,
          {
            entity: itemType,
            fieldsById: Object.fromEntries(
              allFields
                .filter(
                  (f) => f.relationships.item_type.data.id === itemType.id,
                )
                .map((field) => [field.id, field]),
            ),
            fieldsetsById: Object.fromEntries(
              allFieldsets
                .filter(
                  (f) => f.relationships.item_type.data.id === itemType.id,
                )
                .map((fieldset) => [fieldset.id, fieldset]),
            ),
          },
        ]),
    ),
    menuItemsById: Object.fromEntries(
      menuItemsResponse.data.map((menuItem) => [menuItem.id, menuItem]),
    ),
    schemaMenuItemsById: Object.fromEntries(
      schemaMenuItemsResponse.data.map((schemaMenuItem) => [
        schemaMenuItem.id,
        schemaMenuItem,
      ]),
    ),
    pluginsById: Object.fromEntries(
      pluginsResponse.data.map((plugin) => [plugin.id, plugin]),
    ),
    workflowsById: Object.fromEntries(
      workflowsResponse.data.map((workflow) => [workflow.id, workflow]),
    ),
    itemTypeFiltersById: Object.fromEntries(
      itemTypeFiltersResponse.data
        .filter((itf) => itf.attributes.shared)
        .map((itemTypeFilter) => [itemTypeFilter.id, itemTypeFilter]),
    ),
    uploadFiltersById: Object.fromEntries(
      uploadFiltersResponse.data
        .filter((itf) => itf.attributes.shared)
        .map((uploadFilter) => [uploadFilter.id, uploadFilter]),
    ),
  };
}

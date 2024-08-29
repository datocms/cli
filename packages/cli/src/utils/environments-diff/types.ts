import type { CmaClient } from '@datocms/cli-utils';

export type EntityIdsToBeRecreated = {
  field: string[];
  fieldset: string[];
  itemType: string[];
  plugin: string[];
  workflow: string[];
  menuItem: string[];
  schemaMenuItem: string[];
  itemTypeFilter: string[];
  uploadCollection: string[];
};

export type ItemTypeInfo = {
  entity: CmaClient.SchemaTypes.ItemType;
  fieldsById: Record<string, CmaClient.SchemaTypes.Field>;
  fieldsetsById: Record<string, CmaClient.SchemaTypes.Fieldset>;
};

export type Schema = {
  siteEntity: CmaClient.SchemaTypes.Site;
  itemTypesById: Record<string, ItemTypeInfo>;
  menuItemsById: Record<string, CmaClient.SchemaTypes.MenuItem>;
  schemaMenuItemsById: Record<string, CmaClient.SchemaTypes.SchemaMenuItem>;
  uploadCollectionsById: Record<string, CmaClient.SchemaTypes.UploadCollection>;
  pluginsById: Record<string, CmaClient.SchemaTypes.Plugin>;
  workflowsById: Record<string, CmaClient.SchemaTypes.Workflow>;
  itemTypeFiltersById: Record<string, CmaClient.SchemaTypes.ItemTypeFilter>;
  uploadFiltersById: Record<string, CmaClient.SchemaTypes.UploadFilter>;
};

export type LogCommand = {
  type: 'log';
  message: string;
};

export type CreateUploadFilterClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.uploadFilters.create';
  arguments: Parameters<CmaClient.Client['uploadFilters']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateUploadFilterClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.uploadFilters.update';
  arguments: Parameters<CmaClient.Client['uploadFilters']['rawUpdate']>;
};

export type DestroyUploadFilterClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.uploadFilters.destroy';
  arguments: Parameters<CmaClient.Client['uploadFilters']['rawDestroy']>;
};

export type CreateItemTypeFilterClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.itemTypeFilters.create';
  arguments: Parameters<CmaClient.Client['itemTypeFilters']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateItemTypeFilterClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.itemTypeFilters.update';
  arguments: Parameters<CmaClient.Client['itemTypeFilters']['rawUpdate']>;
};

export type DestroyItemTypeFilterClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.itemTypeFilters.destroy';
  arguments: Parameters<CmaClient.Client['itemTypeFilters']['rawDestroy']>;
};

export type CreateWorkflowClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.workflows.create';
  arguments: Parameters<CmaClient.Client['workflows']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateWorkflowClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.workflows.update';
  arguments: Parameters<CmaClient.Client['workflows']['rawUpdate']>;
};

export type DestroyWorkflowClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.workflows.destroy';
  arguments: Parameters<CmaClient.Client['workflows']['rawDestroy']>;
};

export type CreatePluginClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.plugins.create';
  arguments: Parameters<CmaClient.Client['plugins']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdatePluginClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.plugins.update';
  arguments: Parameters<CmaClient.Client['plugins']['rawUpdate']>;
};

export type DestroyPluginClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.plugins.destroy';
  arguments: Parameters<CmaClient.Client['plugins']['rawDestroy']>;
};

export type CreateFieldClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.fields.create';
  arguments: Parameters<CmaClient.Client['fields']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateFieldClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.fields.update';
  arguments: Parameters<CmaClient.Client['fields']['rawUpdate']>;
  fieldType: string;
};

export type DestroyFieldClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.fields.destroy';
  arguments: Parameters<CmaClient.Client['fields']['rawDestroy']>;
};

export type CreateFieldsetClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.fieldsets.create';
  arguments: Parameters<CmaClient.Client['fieldsets']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateFieldsetClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.fieldsets.update';
  arguments: Parameters<CmaClient.Client['fieldsets']['rawUpdate']>;
};

export type DestroyFieldsetClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.fieldsets.destroy';
  arguments: Parameters<CmaClient.Client['fieldsets']['rawDestroy']>;
};

export type CreateItemTypeClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.itemTypes.create';
  arguments: Parameters<CmaClient.Client['itemTypes']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateItemTypeClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.itemTypes.update';
  arguments: Parameters<CmaClient.Client['itemTypes']['rawUpdate']>;
};

export type DestroyItemTypeClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.itemTypes.destroy';
  arguments: Parameters<CmaClient.Client['itemTypes']['rawDestroy']>;
};

export type ReorderItemTypeFieldsAndFieldsetsClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.itemTypes.rawReorderFieldsAndFieldsets';
  arguments: Parameters<
    CmaClient.Client['itemTypes']['rawReorderFieldsAndFieldsets']
  >;
};

export type UpdateRoleDiff<T> = {
  add?: T[];
  remove?: T[];
};

export type RoleItemTypePermission = Omit<
  NonNullable<
    NonNullable<
      CmaClient.SchemaTypes.RoleUpdateSchema['data']['attributes']
    >['positive_item_type_permissions']
  >[0],
  'environment'
>;

export type RoleUploadPermission = Omit<
  NonNullable<
    NonNullable<
      CmaClient.SchemaTypes.RoleUpdateSchema['data']['attributes']
    >['positive_upload_permissions']
  >[0],
  'environment'
>;

export type UpdateRoleClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.roles.updateCurrentEnvironmentPermissions';
  roleId: string;
  changes: {
    positive_item_type_permissions?: UpdateRoleDiff<RoleItemTypePermission>;
    negative_item_type_permissions?: UpdateRoleDiff<RoleItemTypePermission>;
    positive_upload_permissions?: UpdateRoleDiff<RoleUploadPermission>;
    negative_upload_permissions?: UpdateRoleDiff<RoleUploadPermission>;
  };
};

export type UpdateSiteClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.site.update';
  arguments: Parameters<CmaClient.Client['site']['rawUpdate']>;
};

export type CreateMenuItemClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.menuItems.create';
  arguments: Parameters<CmaClient.Client['menuItems']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateMenuItemClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.menuItems.update';
  arguments: Parameters<CmaClient.Client['menuItems']['rawUpdate']>;
};

export type DestroyMenuItemClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.menuItems.destroy';
  arguments: Parameters<CmaClient.Client['menuItems']['rawDestroy']>;
};

export type ReorderMenuItemsClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.menuItems.reorder';
  arguments: Parameters<CmaClient.Client['menuItems']['rawReorder']>;
};

export type CreateSchemaMenuItemClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.schemaMenuItems.create';
  arguments: Parameters<CmaClient.Client['schemaMenuItems']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateSchemaMenuItemClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.schemaMenuItems.update';
  arguments: Parameters<CmaClient.Client['schemaMenuItems']['rawUpdate']>;
};

export type DestroySchemaMenuItemClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.schemaMenuItems.destroy';
  arguments: Parameters<CmaClient.Client['schemaMenuItems']['rawDestroy']>;
};

export type ReorderSchemaMenuItemsClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.schemaMenuItems.reorder';
  arguments: Parameters<CmaClient.Client['schemaMenuItems']['rawReorder']>;
};

export type CreateUploadCollectionClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.uploadCollections.create';
  arguments: Parameters<CmaClient.Client['uploadCollections']['rawCreate']>;
  oldEnvironmentId: string;
};

export type UpdateUploadCollectionClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.uploadCollections.update';
  arguments: Parameters<CmaClient.Client['uploadCollections']['rawUpdate']>;
};

export type DestroyUploadCollectionClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.uploadCollections.destroy';
  arguments: Parameters<CmaClient.Client['uploadCollections']['rawDestroy']>;
};

export type ReorderUploadCollectionsClientCommand = {
  type: 'apiCallClientCommand';
  call: 'client.uploadCollections.reorder';
  arguments: Parameters<CmaClient.Client['uploadCollections']['rawReorder']>;
};

export type ClientApiCallCommand =
  | CreateFieldClientCommand
  | UpdateFieldClientCommand
  | DestroyFieldClientCommand
  | CreatePluginClientCommand
  | UpdatePluginClientCommand
  | DestroyPluginClientCommand
  | CreateItemTypeFilterClientCommand
  | UpdateItemTypeFilterClientCommand
  | DestroyItemTypeFilterClientCommand
  | CreateUploadFilterClientCommand
  | UpdateUploadFilterClientCommand
  | DestroyUploadFilterClientCommand
  | CreateWorkflowClientCommand
  | UpdateWorkflowClientCommand
  | DestroyWorkflowClientCommand
  | CreateFieldsetClientCommand
  | UpdateFieldsetClientCommand
  | DestroyFieldsetClientCommand
  | CreateItemTypeClientCommand
  | UpdateItemTypeClientCommand
  | DestroyItemTypeClientCommand
  | ReorderItemTypeFieldsAndFieldsetsClientCommand
  | UpdateRoleClientCommand
  | CreateMenuItemClientCommand
  | UpdateMenuItemClientCommand
  | DestroyMenuItemClientCommand
  | ReorderMenuItemsClientCommand
  | CreateSchemaMenuItemClientCommand
  | UpdateSchemaMenuItemClientCommand
  | DestroySchemaMenuItemClientCommand
  | ReorderSchemaMenuItemsClientCommand
  | CreateUploadCollectionClientCommand
  | UpdateUploadCollectionClientCommand
  | DestroyUploadCollectionClientCommand
  | ReorderUploadCollectionsClientCommand
  | UpdateSiteClientCommand;

export type Command = LogCommand | ClientApiCallCommand;

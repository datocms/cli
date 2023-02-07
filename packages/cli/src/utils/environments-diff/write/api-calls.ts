import * as ts from 'typescript';
import * as Types from '../types';
import { createJsonLiteral } from '../utils';
import * as Utils from '@datocms/rest-client-utils';
import {} from './get-entity-ids-to-be-recreated';
import { SimpleSchemaTypes } from '@datocms/cma-client-node';
import { upperFirst, omit } from 'lodash';

type PossibleMapping = keyof Types.EntityIdsToBeRecreated;

function assignToMapping(
  kind: PossibleMapping,
  oldEnvironmentId: string,
  expression: ts.Expression,
): ts.Node {
  return ts.factory.createExpressionStatement(
    ts.factory.createBinaryExpression(
      ts.factory.createElementAccessExpression(
        ts.factory.createIdentifier(`new${upperFirst(kind)}s`),
        ts.factory.createStringLiteral(oldEnvironmentId),
      ),
      ts.SyntaxKind.EqualsToken,
      expression,
    ),
  );
}

function makeApiCall(
  command: Types.ClientApiCallCommand,
  argumentsArray: ts.Expression[],
) {
  return ts.factory.createAwaitExpression(
    ts.factory.createCallExpression(
      ts.factory.createIdentifier(command.call),
      undefined,
      argumentsArray,
    ),
  );
}

function fetchNewId(
  kind: PossibleMapping,
  oldEnvironmentId: string,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Expression {
  return entityIdsToBeRecreated[kind].includes(oldEnvironmentId)
    ? ts.factory.createPropertyAccessExpression(
        ts.factory.createElementAccessExpression(
          ts.factory.createIdentifier(`new${upperFirst(kind)}s`),
          ts.factory.createStringLiteral(oldEnvironmentId),
        ),
        'id',
      )
    : ts.factory.createStringLiteral(oldEnvironmentId);
}

function fetchNewRef<T extends { id: string; type: string }>(
  kind: PossibleMapping,
  oldRefOrId: T | string | undefined,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
) {
  if (!oldRefOrId) {
    return createJsonLiteral(oldRefOrId);
  }

  const id = typeof oldRefOrId === 'string' ? oldRefOrId : oldRefOrId.id;

  if (!entityIdsToBeRecreated[kind].includes(id)) {
    return createJsonLiteral(oldRefOrId);
  }

  return ts.factory.createElementAccessExpression(
    ts.factory.createIdentifier(`new${upperFirst(kind)}s`),
    ts.factory.createStringLiteral(id),
  );
}

function deserializeBody(body: Record<string, unknown>) {
  return createJsonLiteral(
    omit(Utils.deserializeResponseBody(body), 'type', 'id'),
  );
}

function deserializeAndReplaceNewIdsInBody(
  body: Record<string, unknown>,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Expression {
  return createJsonLiteral(
    omit(Utils.deserializeResponseBody(body), 'type', 'id'),
    {
      replace: (rawPath, value): ts.Expression | undefined => {
        const path = rawPath
          .map((c) => (typeof c === 'string' ? c : '*'))
          .join('.');

        switch (path) {
          case 'validators.slug_title_field.title_field_id': {
            const fieldId = value as string;
            return fetchNewId('field', fieldId, entityIdsToBeRecreated);
          }
          case 'validators.rich_text_blocks.item_types':
          case 'validators.structured_text_blocks.item_types':
          case 'validators.structured_text_links.item_types':
          case 'validators.item_item_type.item_types':
          case 'validators.items_item_type.item_types': {
            const itemTypeIds = value as string[];
            return ts.factory.createArrayLiteralExpression(
              itemTypeIds.map((itemTypeId) =>
                fetchNewId('itemType', itemTypeId, entityIdsToBeRecreated),
              ),
            );
          }
          case 'appearance.editor':
          case 'appearance.addons.*.id': {
            const pluginId = value as string;
            return fetchNewId('plugin', pluginId, entityIdsToBeRecreated);
          }
          case 'ordering_field':
          case 'title_field':
          case 'image_preview_field':
          case 'excerpt_field': {
            const fieldRef = value as SimpleSchemaTypes.FieldData;
            return fetchNewRef('field', fieldRef, entityIdsToBeRecreated);
          }
          case 'item_type': {
            const itemTypeRef = value as SimpleSchemaTypes.ItemTypeData;
            return fetchNewRef('itemType', itemTypeRef, entityIdsToBeRecreated);
          }
          case 'item_type_filter': {
            const itemTypeRef = value as SimpleSchemaTypes.ItemTypeData;
            return fetchNewRef(
              'itemTypeFilter',
              itemTypeRef,
              entityIdsToBeRecreated,
            );
          }
          case 'workflow': {
            const workflowRef = value as SimpleSchemaTypes.WorkflowData;
            return fetchNewRef('workflow', workflowRef, entityIdsToBeRecreated);
          }
          case 'fieldset': {
            const fieldsetRef = value as SimpleSchemaTypes.FieldsetData;
            return fetchNewRef('fieldset', fieldsetRef, entityIdsToBeRecreated);
          }
          case 'parent': {
            const menuItemRef = value as SimpleSchemaTypes.MenuItemData;
            return fetchNewRef('menuItem', menuItemRef, entityIdsToBeRecreated);
          }
          default: {
            // leave as it is
            return undefined;
          }
        }
      },
    },
  );
}

export function buildCreateFieldClientCommandNode(
  command: Types.CreateFieldClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [itemTypeId, body] = command.arguments;

  const apiCall = makeApiCall(command, [
    fetchNewRef('itemType', itemTypeId, entityIdsToBeRecreated),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);

  return assignToMapping('field', command.oldEnvironmentId, apiCall);
}

export function buildUpdateFieldClientCommandNode(
  command: Types.UpdateFieldClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [fieldId, body] = command.arguments;

  return makeApiCall(command, [
    fetchNewRef('field', fieldId, entityIdsToBeRecreated),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildDestroyFieldClientCommandNode(
  command: Types.DestroyFieldClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [fieldId] = command.arguments;
  return makeApiCall(command, [ts.factory.createStringLiteral(fieldId)]);
}

export function buildCreateFieldsetClientCommandNode(
  command: Types.CreateFieldsetClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [itemTypeId, body] = command.arguments;

  const apiCall = makeApiCall(command, [
    fetchNewRef('itemType', itemTypeId, entityIdsToBeRecreated),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);

  return assignToMapping('fieldset', command.oldEnvironmentId, apiCall);
}

export function buildUpdateFieldsetClientCommandNode(
  command: Types.UpdateFieldsetClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [fieldsetId, body] = command.arguments;

  return makeApiCall(command, [
    fetchNewRef('fieldset', fieldsetId, entityIdsToBeRecreated),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildDestroyFieldsetClientCommandNode(
  command: Types.DestroyFieldsetClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [fieldsetId] = command.arguments;
  return makeApiCall(command, [ts.factory.createStringLiteral(fieldsetId)]);
}

export function buildCreateItemTypeClientCommandNode(
  command: Types.CreateItemTypeClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [body, queryParams] = command.arguments;
  const apiCall = makeApiCall(command, [
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
    createJsonLiteral(queryParams),
  ]);
  return assignToMapping('itemType', command.oldEnvironmentId, apiCall);
}

export function buildUpdateItemTypeClientCommandNode(
  command: Types.UpdateItemTypeClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [itemTypeId, body] = command.arguments;

  return makeApiCall(command, [
    fetchNewRef('itemType', itemTypeId, entityIdsToBeRecreated),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildDestroyItemTypeClientCommandNode(
  command: Types.DestroyItemTypeClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [itemTypeId, queryParams] = command.arguments;
  return makeApiCall(command, [
    ts.factory.createStringLiteral(itemTypeId),
    createJsonLiteral(queryParams),
  ]);
}

export function buildCreateUploadFilterClientCommandNode(
  command: Types.CreateUploadFilterClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [body] = command.arguments;
  return makeApiCall(command, [deserializeBody(body)]);
}

export function buildUpdateUploadFilterClientCommandNode(
  command: Types.UpdateUploadFilterClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [uploadFilterId, body] = command.arguments;

  return makeApiCall(command, [
    ts.factory.createStringLiteral(uploadFilterId),
    deserializeBody(body),
  ]);
}

export function buildDestroyUploadFilterClientCommandNode(
  command: Types.DestroyUploadFilterClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [uploadFilterId] = command.arguments;
  return makeApiCall(command, [ts.factory.createStringLiteral(uploadFilterId)]);
}

export function buildCreateItemTypeFilterClientCommandNode(
  command: Types.CreateItemTypeFilterClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [body] = command.arguments;
  const apiCall = makeApiCall(command, [
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
  return assignToMapping('itemTypeFilter', command.oldEnvironmentId, apiCall);
}

export function buildUpdateItemTypeFilterClientCommandNode(
  command: Types.UpdateItemTypeFilterClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [itemTypeFilterId, body] = command.arguments;

  return makeApiCall(command, [
    ts.factory.createStringLiteral(itemTypeFilterId),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildDestroyItemTypeFilterClientCommandNode(
  command: Types.DestroyItemTypeFilterClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [itemTypeFilterId] = command.arguments;
  return makeApiCall(command, [
    ts.factory.createStringLiteral(itemTypeFilterId),
  ]);
}

export function buildCreateWorkflowClientCommandNode(
  command: Types.CreateWorkflowClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [body] = command.arguments;

  const apiCall = makeApiCall(command, [
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);

  return assignToMapping('workflow', command.oldEnvironmentId, apiCall);
}

export function buildUpdateWorkflowClientCommandNode(
  command: Types.UpdateWorkflowClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [workflowId, body] = command.arguments;

  return makeApiCall(command, [
    ts.factory.createStringLiteral(workflowId),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildDestroyWorkflowClientCommandNode(
  command: Types.DestroyWorkflowClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [workflowId] = command.arguments;
  return makeApiCall(command, [ts.factory.createStringLiteral(workflowId)]);
}

export function buildCreatePluginClientCommandNode(
  command: Types.CreatePluginClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [body] = command.arguments;

  const apiCall = makeApiCall(command, [
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);

  return assignToMapping('plugin', command.oldEnvironmentId, apiCall);
}

export function buildUpdatePluginClientCommandNode(
  command: Types.UpdatePluginClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [pluginId, body] = command.arguments;

  return makeApiCall(command, [
    fetchNewRef('plugin', pluginId, entityIdsToBeRecreated),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildDestroyPluginClientCommandNode(
  command: Types.DestroyPluginClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [pluginId] = command.arguments;
  return makeApiCall(command, [ts.factory.createStringLiteral(pluginId)]);
}

export function buildUpdateSiteClientCommandNode(
  command: Types.UpdateSiteClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [body] = command.arguments;
  return makeApiCall(command, [
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildUpdateRoleClientCommandNode(
  command: Types.UpdateRoleClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node[] {
  return [
    makeApiCall(command, [
      ts.factory.createStringLiteral(command.roleId),
      createJsonLiteral(command.changes, {
        replace: (rawPath, value): ts.Expression | undefined => {
          const path = rawPath
            .map((c) => (typeof c === 'string' ? c : '*'))
            .join('.');

          switch (path) {
            case 'positive_item_type_permissions.add.*.item_type':
            case 'positive_item_type_permissions.remove.*.item_type':
            case 'negative_item_type_permissions.add.*.item_type':
            case 'negative_item_type_permissions.remove.*.item_type': {
              const itemTypeId = value as string;
              return fetchNewId('itemType', itemTypeId, entityIdsToBeRecreated);
            }
            case 'positive_item_type_permissions.add.*.workflow':
            case 'positive_item_type_permissions.remove.*.workflow':
            case 'negative_item_type_permissions.add.*.workflow':
            case 'negative_item_type_permissions.remove.*.workflow': {
              const workflowId = value as string;
              return fetchNewId('field', workflowId, entityIdsToBeRecreated);
            }
            default: {
              // leave as it is
              return undefined;
            }
          }
        },
      }),
    ]),
  ];
}

export function buildCreateMenuItemClientCommandNode(
  command: Types.CreateMenuItemClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [body] = command.arguments;
  const apiCall = makeApiCall(command, [
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
  return assignToMapping('menuItem', command.oldEnvironmentId, apiCall);
}

export function buildUpdateMenuItemClientCommandNode(
  command: Types.UpdateMenuItemClientCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [menuItemId, body] = command.arguments;

  return makeApiCall(command, [
    fetchNewRef('menuItem', menuItemId, entityIdsToBeRecreated),
    deserializeAndReplaceNewIdsInBody(body, entityIdsToBeRecreated),
  ]);
}

export function buildDestroyMenuItemClientCommandNode(
  command: Types.DestroyMenuItemClientCommand,
  _entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node {
  const [menuItemId] = command.arguments;
  return makeApiCall(command, [ts.factory.createStringLiteral(menuItemId)]);
}

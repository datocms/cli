import * as ts from 'typescript';
import * as Types from '../types';
import { parseAstFromCode, writeCodeFromAst } from '../utils';
import { Options, format as prettier } from 'prettier';
import * as ApiCommands from './api-calls';
import { buildCommentNode } from './comments';
import { getEntityIdsToBeRecreated } from './get-entity-ids-to-be-recreated';
import { upperFirst } from 'lodash';

function writeApiCallClientCommand(
  command: Types.ClientApiCallCommand,
  entityIdsToBeRecreated: Types.EntityIdsToBeRecreated,
): ts.Node | ts.Node[] {
  switch (command.call) {
    case 'client.fields.create':
      return ApiCommands.buildCreateFieldClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.fields.update':
      return ApiCommands.buildUpdateFieldClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.fields.destroy':
      return ApiCommands.buildDestroyFieldClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.fieldsets.create':
      return ApiCommands.buildCreateFieldsetClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.fieldsets.update':
      return ApiCommands.buildUpdateFieldsetClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.fieldsets.destroy':
      return ApiCommands.buildDestroyFieldsetClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.itemTypes.create':
      return ApiCommands.buildCreateItemTypeClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.itemTypes.update':
      return ApiCommands.buildUpdateItemTypeClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.itemTypes.destroy':
      return ApiCommands.buildDestroyItemTypeClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.uploadFilters.create':
      return ApiCommands.buildCreateUploadFilterClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.uploadFilters.update':
      return ApiCommands.buildUpdateUploadFilterClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.uploadFilters.destroy':
      return ApiCommands.buildDestroyUploadFilterClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.itemTypeFilters.create':
      return ApiCommands.buildCreateItemTypeFilterClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.itemTypeFilters.update':
      return ApiCommands.buildUpdateItemTypeFilterClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.itemTypeFilters.destroy':
      return ApiCommands.buildDestroyItemTypeFilterClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.workflows.create':
      return ApiCommands.buildCreateWorkflowClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.workflows.update':
      return ApiCommands.buildUpdateWorkflowClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.workflows.destroy':
      return ApiCommands.buildDestroyWorkflowClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.plugins.create':
      return ApiCommands.buildCreatePluginClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.plugins.update':
      return ApiCommands.buildUpdatePluginClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.plugins.destroy':
      return ApiCommands.buildDestroyPluginClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.roles.updateCurrentEnvironmentPermissions':
      return ApiCommands.buildUpdateRoleClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.menuItems.create':
      return ApiCommands.buildCreateMenuItemClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.menuItems.update':
      return ApiCommands.buildUpdateMenuItemClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.menuItems.destroy':
      return ApiCommands.buildDestroyMenuItemClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    case 'client.site.update':
      return ApiCommands.buildUpdateSiteClientCommandNode(
        command,
        entityIdsToBeRecreated,
      );
    default:
      throw new Error(`Dont't know how to handle ${JSON.stringify(command)}`);
  }
}

const jsHeader = `'use strict';\n\n/** @param client { import("@datocms/cli/lib/cma-client-node").Client } */\n`;

export function write(
  commands: Types.Command[],
  { format, ...prettierOptions }: Options & { format: 'js' | 'ts' },
) {
  const entityIdsToBeRecreated = getEntityIdsToBeRecreated(commands);

  const nodes = commands.flatMap((command) => {
    switch (command.type) {
      case 'apiCallClientCommand': {
        return writeApiCallClientCommand(command, entityIdsToBeRecreated);
      }
      case 'comment': {
        return buildCommentNode(command);
      }
      default: {
        throw new Error('Type not handled!');
      }
    }
  });

  const skeleton =
    format === 'ts'
      ? `
      import { Client, SimpleSchemaTypes } from '@datocms/cli/lib/cma-client-node';

      export default async function(client: Client): Promise<void> {
        ${Object.entries(entityIdsToBeRecreated)
          .filter((pair) => pair[1].length > 0)
          .map(
            ([entityType]) =>
              `const new${upperFirst(
                entityType,
              )}s: Record<string, SimpleSchemaTypes.${upperFirst(
                entityType,
              )}> = {};`,
          )
          .join('\n')}
      }
      `
      : `
      module.exports = async function (client) {
        ${Object.entries(entityIdsToBeRecreated)
          .filter((pair) => pair[1].length > 0)
          .map(([entityType]) => `const new${upperFirst(entityType)}s = {};`)
          .join('\n')}
      }
  `;

  const sourceFile = parseAstFromCode(skeleton);

  const transformer =
    <T extends ts.Node>(context: ts.TransformationContext) =>
    (rootNode: T) => {
      function visit(node: ts.Node): ts.Node {
        if (ts.isFunctionDeclaration(node)) {
          const functionDeclaration = <ts.FunctionDeclaration>node;

          return ts.factory.updateFunctionDeclaration(
            functionDeclaration,
            undefined,
            functionDeclaration.modifiers,
            functionDeclaration.asteriskToken,
            functionDeclaration.name,
            functionDeclaration.typeParameters,
            functionDeclaration.parameters,
            undefined,
            ts.factory.createBlock(
              ts.factory.createNodeArray([
                ...functionDeclaration.body!.statements,
                ...(nodes as ts.Statement[]),
              ]),
              true,
            ),
          );
        }

        if (ts.isFunctionExpression(node)) {
          const functionExpression = <ts.FunctionExpression>node;

          return ts.factory.updateFunctionExpression(
            functionExpression,
            functionExpression.modifiers,
            functionExpression.asteriskToken,
            functionExpression.name,
            functionExpression.typeParameters,
            functionExpression.parameters,
            undefined,
            ts.factory.createBlock(
              ts.factory.createNodeArray([
                ...functionExpression.body!.statements,
                ...(nodes as ts.Statement[]),
              ]),
              true,
            ),
          );
        }

        return ts.visitEachChild(node, visit, context);
      }

      return ts.visitNode(rootNode, visit);
    };

  const result = ts.transform(sourceFile, [transformer]);

  const code =
    (format === 'js' ? jsHeader : '') +
    writeCodeFromAst(ts.factory.createNodeArray(result.transformed)).replace(
      /(\s+console\.log|export)/g,
      '\n$1',
    );

  return prettier(code, prettierOptions);
}

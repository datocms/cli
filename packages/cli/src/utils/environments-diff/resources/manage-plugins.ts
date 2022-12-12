import { difference, intersection, isEqual, omit, pick } from 'lodash';
import { CmaClient } from '@datocms/cli-utils';
import {
  Command,
  CreatePluginClientCommand,
  Schema,
  UpdatePluginClientCommand,
} from '../types';
import { buildPluginTitle } from '../utils';
import { buildComment } from './comments';

function buildCreatePluginClientCommand(
  plugin: CmaClient.SchemaTypes.Plugin,
): Command[] {
  const commands: Command[] = [];

  const createCommand: CreatePluginClientCommand = {
    type: 'apiCallClientCommand',
    call: 'client.plugins.create',
    arguments: [
      {
        data: {
          type: 'plugin',
          attributes: plugin.attributes.package_name
            ? pick(plugin.attributes, 'package_name')
            : plugin.meta.version === '1'
            ? omit(plugin.attributes, 'parameters')
            : omit(
                plugin.attributes,
                'parameter_definitions',
                'field_types',
                'plugin_type',
                'parameters',
              ),
        },
      },
    ],
    oldEnvironmentId: plugin.id,
  };
  commands.push(createCommand);

  if (!isEqual(plugin.attributes.parameters, {})) {
    const updateCommand: UpdatePluginClientCommand = {
      type: 'apiCallClientCommand',
      call: 'client.plugins.update',
      arguments: [
        plugin.id,
        {
          data: {
            id: plugin.id,
            type: 'plugin',
            attributes: pick(plugin.attributes, 'parameters'),
          },
        },
      ],
    };

    commands.push(updateCommand);
  }

  return [
    buildComment(
      `${
        plugin.attributes.package_name ? 'Install' : 'Create private'
      } ${buildPluginTitle(plugin)}`,
    ),
    ...commands,
  ];
}

function buildDestroyPluginClientCommand(
  plugin: CmaClient.SchemaTypes.Plugin,
): Command[] {
  return [
    buildComment(`Delete ${buildPluginTitle(plugin)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.plugins.destroy',
      arguments: [plugin.id],
    },
  ];
}

function buildUpdatePluginClientCommand(
  newPlugin: CmaClient.SchemaTypes.Plugin,
  oldPlugin: CmaClient.SchemaTypes.Plugin,
): Command[] {
  const isLegacy = oldPlugin.meta.version === '1';
  const isPublic = Boolean(oldPlugin.attributes.package_name);

  const commands: Command[] = [];

  const onlyChangedAttributes = (...allowedAttributes: string[]) =>
    pick(
      newPlugin.attributes,
      intersection(
        (
          Object.keys(newPlugin.attributes) as Array<
            keyof CmaClient.SchemaTypes.PluginAttributes
          >
        ).filter(
          (attribute) =>
            !isEqual(
              oldPlugin.attributes[attribute],
              newPlugin.attributes[attribute],
            ),
        ),
        allowedAttributes,
      ),
    );

  if (isLegacy) {
    if (isPublic) {
      if (!newPlugin.attributes.package_version) {
        const updateCommand: UpdatePluginClientCommand = {
          type: 'apiCallClientCommand',
          call: 'client.plugins.update',
          arguments: [
            oldPlugin.id,
            {
              data: {
                id: oldPlugin.id,
                type: 'plugin',
                attributes: pick(
                  newPlugin.attributes,
                  'name',
                  'description',
                  'url',
                  'permissions',
                ),
              },
            },
          ],
        };

        commands.push(
          buildComment(
            `Convert legacy ${buildPluginTitle(newPlugin)} into private plugin`,
          ),
        );
        commands.push(updateCommand);
      } else if (
        newPlugin.attributes.package_version !==
        oldPlugin.attributes.package_version
      ) {
        const updateCommand: UpdatePluginClientCommand = {
          type: 'apiCallClientCommand',
          call: 'client.plugins.update',
          arguments: [
            oldPlugin.id,
            {
              data: {
                id: oldPlugin.id,
                type: 'plugin',
                attributes: pick(newPlugin.attributes, 'package_version'),
              },
            },
          ],
        };
        commands.push(
          buildComment(
            `Upgrade version of legacy ${buildPluginTitle(newPlugin)}`,
          ),
        );
        commands.push(updateCommand);
      }

      if (
        !isEqual(
          newPlugin.attributes.parameters,
          oldPlugin.attributes.parameters,
        )
      ) {
        const updateCommand: UpdatePluginClientCommand = {
          type: 'apiCallClientCommand',
          call: 'client.plugins.update',
          arguments: [
            oldPlugin.id,
            {
              data: {
                id: oldPlugin.id,
                type: 'plugin',
                attributes: pick(newPlugin.attributes, 'parameters'),
              },
            },
          ],
        };
        commands.push(
          buildComment(
            `Update settings of legacy ${buildPluginTitle(oldPlugin)}`,
          ),
        );
        commands.push(updateCommand);
      }
    } else {
      const changedAttributes = onlyChangedAttributes(
        'name',
        'description',
        'url',
        'parameters',
        'permissions',
      );

      if (Object.keys(changedAttributes).length > 0) {
        const updateCommand: UpdatePluginClientCommand = {
          type: 'apiCallClientCommand',
          call: 'client.plugins.update',
          arguments: [
            oldPlugin.id,
            {
              data: {
                id: oldPlugin.id,
                type: 'plugin',
                attributes: changedAttributes,
              },
            },
          ],
        };
        commands.push(
          buildComment(`Update legacy private ${buildPluginTitle(newPlugin)}`),
        );
        commands.push(updateCommand);
      }
    }
  } else {
    if (isPublic) {
      if (!newPlugin.attributes.package_version) {
        const updateCommand: UpdatePluginClientCommand = {
          type: 'apiCallClientCommand',
          call: 'client.plugins.update',
          arguments: [
            oldPlugin.id,
            {
              data: {
                id: oldPlugin.id,
                type: 'plugin',
                attributes: onlyChangedAttributes(
                  'name',
                  'description',
                  'url',
                  'permissions',
                  'parameters',
                ),
              },
            },
          ],
        };
        commands.push(
          buildComment(
            `Convert ${buildPluginTitle(newPlugin)} into private plugin`,
          ),
        );
        commands.push(updateCommand);
      } else {
        const changedAttributes = onlyChangedAttributes(
          'package_version',
          'parameters',
        );

        if (Object.keys(changedAttributes).length > 0) {
          const updateCommand: UpdatePluginClientCommand = {
            type: 'apiCallClientCommand',
            call: 'client.plugins.update',
            arguments: [
              oldPlugin.id,
              {
                data: {
                  id: oldPlugin.id,
                  type: 'plugin',
                  attributes: changedAttributes,
                },
              },
            ],
          };
          commands.push(
            buildComment(
              `${
                'package_version' in changedAttributes
                  ? 'Upgrade version'
                  : 'Update settings'
              } of ${buildPluginTitle(oldPlugin)}`,
            ),
          );
          commands.push(updateCommand);
        }
      }
    } else {
      const changedAttributes = onlyChangedAttributes(
        'name',
        'description',
        'url',
        'parameters',
        'permissions',
      );

      if (Object.keys(changedAttributes).length > 0) {
        const updateCommand: UpdatePluginClientCommand = {
          type: 'apiCallClientCommand',
          call: 'client.plugins.update',
          arguments: [
            oldPlugin.id,
            {
              data: {
                id: oldPlugin.id,
                type: 'plugin',
                attributes: changedAttributes,
              },
            },
          ],
        };
        commands.push(
          buildComment(
            `Update settings of private ${buildPluginTitle(oldPlugin)}`,
          ),
        );
        commands.push(updateCommand);
      }
    }
  }

  return commands;
}

export function managePlugins(newSchema: Schema, oldSchema: Schema): Command[] {
  const oldEntityIds = Object.keys(oldSchema.pluginsById);
  const newEntityIds = Object.keys(newSchema.pluginsById);

  const keptEntityIds = intersection(oldEntityIds, newEntityIds);

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (pluginId) => oldSchema.pluginsById[pluginId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (pluginId) => newSchema.pluginsById[pluginId],
  );

  const commands: Command[] = [
    ...deletedEntities.flatMap(buildDestroyPluginClientCommand),
    ...createdEntities.flatMap(buildCreatePluginClientCommand),
    ...keptEntityIds.flatMap((pluginId) =>
      buildUpdatePluginClientCommand(
        newSchema.pluginsById[pluginId],
        oldSchema.pluginsById[pluginId],
      ),
    ),
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Manage upload filters'), ...commands];
}

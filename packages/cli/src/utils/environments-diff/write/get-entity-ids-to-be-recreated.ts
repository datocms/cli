import * as Types from '../types';

export function getEntityIdsToBeRecreated(
  commands: Types.Command[],
): Types.EntityIdsToBeRecreated {
  return {
    field: commands
      .filter(
        (command): command is Types.CreateFieldClientCommand =>
          command.type === 'apiCallClientCommand' &&
          command.call === 'client.fields.create',
      )
      .map((command) => command.oldEnvironmentId),
    fieldset: commands
      .filter(
        (command): command is Types.CreateFieldsetClientCommand =>
          command.type === 'apiCallClientCommand' &&
          command.call === 'client.fieldsets.create',
      )
      .map((command) => command.oldEnvironmentId),
    itemType: commands
      .filter(
        (command): command is Types.CreateItemTypeClientCommand =>
          command.type === 'apiCallClientCommand' &&
          command.call === 'client.itemTypes.create',
      )
      .map((command) => command.oldEnvironmentId),
    plugin: commands
      .filter(
        (command): command is Types.CreatePluginClientCommand =>
          command.type === 'apiCallClientCommand' &&
          command.call === 'client.plugins.create',
      )
      .map((command) => command.oldEnvironmentId),
    workflow: commands
      .filter(
        (command): command is Types.CreateWorkflowClientCommand =>
          command.type === 'apiCallClientCommand' &&
          command.call === 'client.workflows.create',
      )
      .map((command) => command.oldEnvironmentId),
    menuItem: commands
      .filter(
        (command): command is Types.CreateMenuItemClientCommand =>
          command.type === 'apiCallClientCommand' &&
          command.call === 'client.menuItems.create',
      )
      .map((command) => command.oldEnvironmentId),
    itemTypeFilter: commands
      .filter(
        (command): command is Types.CreateItemTypeFilterClientCommand =>
          command.type === 'apiCallClientCommand' &&
          command.call === 'client.itemTypeFilters.create',
      )
      .map((command) => command.oldEnvironmentId),
  };
}

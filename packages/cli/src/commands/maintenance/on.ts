import { Flags } from '@oclif/core';
import { ClientCommand, Client } from '@datocms/cli-utils';

export default class Command extends ClientCommand<typeof Command.flags> {
  static description = 'Put a project in maintenance mode';

  static flags = {
    ...ClientCommand.flags,
    force: Flags.boolean({
      description:
        'Forces the activation of maintenance mode even there are users currently editing records',
    }),
  };

  async run(): Promise<Client.SimpleSchemaTypes.MaintenanceMode> {
    try {
      this.startSpinner(`Activating maintenance mode`);

      const result = await this.client.maintenanceMode.activate({
        force: this.parsedFlags.force,
      });

      this.stopSpinner();

      return result;
    } catch (e) {
      if (
        e instanceof Client.ApiError &&
        e.findError('ACTIVE_EDITING_SESSIONS')
      ) {
        this.error(
          'Cannot activate maintenance mode as some users are currently editing records',
          {
            suggestions: ['To proceed anyway, use the --force flag'],
          },
        );
      }

      throw e;
    }
  }
}

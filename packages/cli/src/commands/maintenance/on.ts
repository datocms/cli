import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Put a project in maintenance mode';

  static flags = {
    ...CmaClientCommand.flags,
    force: oclif.Flags.boolean({
      description:
        'Forces the activation of maintenance mode even there are users currently editing records',
    }),
  };

  async run(): Promise<CmaClient.SimpleSchemaTypes.MaintenanceMode> {
    this.startSpinner('Activating maintenance mode');

    try {
      const result = await this.client.maintenanceMode.activate({
        force: this.parsedFlags.force,
      });

      this.stopSpinner();

      return result;
    } catch (e) {
      this.stopSpinnerWithFailure();

      if (
        e instanceof CmaClient.ApiError &&
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

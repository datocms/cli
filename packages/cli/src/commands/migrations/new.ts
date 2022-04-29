import { CmaClientCommand, CmaClient, oclif } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Create a new migration script';

  static flags = {
    ...CmaClientCommand.flags,
    force: oclif.Flags.boolean({
      description:
        'Forces the activation of maintenance mode even there are users currently editing records',
    }),
  };

  async run(): Promise<CmaClient.SimpleSchemaTypes.MaintenanceMode> {
    this.startSpinner(`Deactivating maintenance mode`);
    const result = await this.client.maintenanceMode.deactivate();
    this.stopSpinner();

    return result;
  }
}

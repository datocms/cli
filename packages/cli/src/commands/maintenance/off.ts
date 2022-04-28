import { ClientCommand, Client } from '@datocms/cli-utils';

export default class Command extends ClientCommand<typeof Command.flags> {
  static description = 'Take a project out of maintenance mode';

  async run(): Promise<Client.SimpleSchemaTypes.MaintenanceMode> {
    this.startSpinner(`Deactivating maintenance mode`);
    const result = await this.client.maintenanceMode.deactivate();
    this.stopSpinner();

    return result;
  }
}

import { CmaClientCommand, CmaClient } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Run migration scripts that have not run yet';

  async run(): Promise<CmaClient.SimpleSchemaTypes.MaintenanceMode> {
    this.startSpinner(`Deactivating maintenance mode`);
    const result = await this.client.maintenanceMode.deactivate();
    this.stopSpinner();

    return result;
  }
}

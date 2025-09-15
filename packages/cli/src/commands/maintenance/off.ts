import { type CmaClient, CmaClientCommand } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand {
  static description = 'Take a project out of maintenance mode';

  async run(): Promise<CmaClient.ApiTypes.MaintenanceMode> {
    this.startSpinner('Deactivating maintenance mode');

    try {
      const result = await this.client.maintenanceMode.deactivate();
      this.stopSpinner();

      return result;
    } catch (e) {
      this.stopSpinnerWithFailure();

      throw e;
    }
  }
}

import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand {
  static description = 'Destroys a sandbox environment';

  static args = {
    ENVIRONMENT_ID: oclif.Args.string({
      description: 'The environment to destroy',
      required: true,
    }),
  };

  async run(): Promise<CmaClient.ApiTypes.Environment> {
    const {
      args: { ENVIRONMENT_ID: envId },
    } = await this.parse(Command);

    this.startSpinner(`Destroying environment "${envId}"`);

    try {
      const result = await this.client.environments.destroy(envId);

      this.stopSpinner();

      return result;
    } catch (e) {
      this.stopSpinnerWithFailure();

      if (e instanceof CmaClient.ApiError && e.findError('NOT_FOUND')) {
        this.error(`An environment called "${envId}" does not exist`);
      }

      throw e;
    }
  }
}

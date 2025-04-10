import { CmaClient, CmaClientCommand } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Destroys a sandbox environment';

  static args = [
    {
      name: 'ENVIRONMENT_ID',
      description: 'The environment to destroy',
      required: true,
    },
  ];

  async run(): Promise<CmaClient.SimpleSchemaTypes.Environment> {
    const { ENVIRONMENT_ID: envId } = this.parsedArgs;

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

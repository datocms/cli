import { CmaClientCommand, CmaClient } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Promotes a sandbox environment to primary';

  static args = [
    {
      name: 'ENVIRONMENT_ID',
      description: 'The environment to promote',
      required: true,
    },
  ];

  async run(): Promise<CmaClient.SimpleSchemaTypes.Environment> {
    const { ENVIRONMENT_ID: envId } = this.parsedArgs;

    try {
      this.startSpinner(`Promoting environment "${envId}"`);
      const result = await this.client.environments.promote(envId);

      this.stopSpinner();

      return result;
    } catch (e) {
      if (e instanceof CmaClient.ApiError && e.findError('NOT_FOUND')) {
        this.error(`An environment called "${envId}" does not exist!`);
      }

      throw e;
    }
  }
}

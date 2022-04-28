import { ClientCommand, Client } from '@datocms/cli-utils';

export default class Command extends ClientCommand<typeof Command.flags> {
  static description = 'Destroys a sandbox environment';

  static args = [
    {
      name: 'ENVIRONMENT_ID',
      description: 'The environment to destroy',
      required: true,
    },
  ];

  async run(): Promise<Client.SimpleSchemaTypes.Environment> {
    const { ENVIRONMENT_ID: envId } = this.parsedArgs;

    try {
      this.startSpinner(`Destroying environment "${envId}"`);
      const result = await this.client.environments.destroy(envId);

      this.stopSpinner();

      return result;
    } catch (e) {
      if (e instanceof Client.ApiError && e.findError('NOT_FOUND')) {
        this.error(`An environment called "${envId}" does not exist`);
      }

      throw e;
    }
  }
}

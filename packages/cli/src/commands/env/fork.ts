import { ClientCommand, Client } from '@datocms/cli-utils';

export default class Command extends ClientCommand<typeof Command.flags> {
  static description =
    'Creates a new sandbox environment by forking an existing one';

  static args = [
    {
      name: 'SOURCE_ENVIRONMENT_ID',
      description: 'The environment to copy',
      required: true,
    },
    {
      name: 'NEW_ENVIRONMENT_ID',
      description: 'The name of the new sandbox environment to generate',
      required: true,
    },
  ];

  async run(): Promise<Client.SimpleSchemaTypes.Environment> {
    const { SOURCE_ENVIRONMENT_ID: srcEnvId, NEW_ENVIRONMENT_ID: newEnvId } =
      this.parsedArgs;

    try {
      const sourceEnv = await this.client.environments.find(srcEnvId);

      this.startSpinner(
        `Creating a fork of "${sourceEnv.id}" called "${newEnvId}"`,
      );

      const environment = await this.client.environments.fork(sourceEnv.id, {
        id: newEnvId,
      });

      this.stopSpinner();

      return environment;
    } catch (e) {
      if (e instanceof Client.ApiError && e.findError('NOT_FOUND')) {
        this.error(`An environment called "${srcEnvId}" does not exist`);
      }

      if (
        e instanceof Client.ApiError &&
        e.findError('INVALID_FIELD', {
          field: 'name',
          code: 'VALIDATION_UNIQUENESS',
        })
      ) {
        this.error(`An environment called "${newEnvId}" already exists`);
      }

      throw e;
    }
  }
}

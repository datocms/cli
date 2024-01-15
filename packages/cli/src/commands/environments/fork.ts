import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
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

  static flags = {
    ...CmaClientCommand.flags,
    fast: oclif.Flags.boolean({
      description:
        'Run a fast fork. A fast fork reduces processing time, but it also prevents writing to the source environment during the process',
    }),
    force: oclif.Flags.boolean({
      description:
        'Forces the start of a fast fork, even there are users currently editing records in the environment to copy',
      dependsOn: ['fast'],
    }),
  };

  async run(): Promise<CmaClient.SimpleSchemaTypes.Environment> {
    const { SOURCE_ENVIRONMENT_ID: srcEnvId, NEW_ENVIRONMENT_ID: newEnvId } =
      this.parsedArgs;

    const { fast, force } = this.parsedFlags;

    try {
      const sourceEnv = await this.client.environments.find(srcEnvId);

      this.startSpinner(
        `Starting a ${fast ? 'fast ' : ''}fork of "${
          sourceEnv.id
        }" called "${newEnvId}"`,
      );

      const environment = await this.client.environments.fork(
        sourceEnv.id,
        {
          id: newEnvId,
        },
        { fast, force },
      );

      this.stopSpinner();

      return environment;
    } catch (e) {
      if (e instanceof CmaClient.ApiError && e.findError('NOT_FOUND')) {
        this.error(`An environment called "${srcEnvId}" does not exist`);
      }

      if (
        e instanceof CmaClient.ApiError &&
        e.findError('INVALID_FIELD', {
          field: 'name',
          code: 'VALIDATION_UNIQUENESS',
        })
      ) {
        this.error(`An environment called "${newEnvId}" already exists`, {
          suggestions: [
            `To delete the environment, run "${this.config.bin} environments:destroy ${newEnvId}"`,
          ],
        });
      }

      if (
        e instanceof CmaClient.ApiError &&
        e.findError('ACTIVE_EDITING_SESSIONS')
      ) {
        this.error(
          'Cannot proceed with a fast fork of the environment, as some users are currently editing records',
          {
            suggestions: ['To proceed anyway, use the --force flag'],
          },
        );
      }

      throw e;
    }
  }
}

import { type CmaClient, CmaClientCommand } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Renames an environment';

  static args = [
    {
      name: 'ENVIRONMENT_ID',
      description: 'The environment to rename',
      required: true,
    },
    {
      name: 'NEW_ENVIRONMENT_ID',
      description: 'The new environment ID',
      required: true,
    },
  ];

  async run(): Promise<CmaClient.SimpleSchemaTypes.Environment> {
    const { ENVIRONMENT_ID: oldId, NEW_ENVIRONMENT_ID: newId } =
      this.parsedArgs;

    this.startSpinner(`Renaming environment "${oldId}" -> "${newId}"`);

    try {
      const result = await this.client.environments.rename(oldId, {
        id: newId,
      });

      this.stopSpinner();

      return result;
    } catch (e) {
      this.stopSpinnerWithFailure();

      throw e;
    }
  }
}

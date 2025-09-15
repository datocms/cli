import { type CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand {
  static description = 'Renames an environment';

  static args = {
    ENVIRONMENT_ID: oclif.Args.string({
      description: 'The environment to rename',
      required: true,
    }),
    NEW_ENVIRONMENT_ID: oclif.Args.string({
      description: 'The new environment ID',
      required: true,
    }),
  };

  async run(): Promise<CmaClient.ApiTypes.Environment> {
    const {
      args: { ENVIRONMENT_ID: oldId, NEW_ENVIRONMENT_ID: newId },
    } = await this.parse(Command);

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

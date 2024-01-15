import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static aliases = ['environments:index', 'environments:list'];

  static description = 'Lists primary/sandbox environments of a project';

  static flags = {
    ...CmaClientCommand.flags,
    ...oclif.CliUx.ux.table.flags(),
  };

  async run(): Promise<CmaClient.SimpleSchemaTypes.Environment[]> {
    const environments = await this.client.environments.list();

    this.printTable(
      environments,
      ['id', 'meta.primary'],
      ['meta.status', 'meta.created_at', 'meta.last_data_change_at'],
    );

    return environments;
  }
}

import { ClientCommand, Client } from '@datocms/cli-utils';
import { CliUx } from '@oclif/core';

export default class Command extends ClientCommand<typeof Command.flags> {
  static description =
    'Returns information regarding a project primary/sandbox environments';

  static flags = {
    ...ClientCommand.flags,
    ...CliUx.ux.table.flags(),
  };

  async run(): Promise<Client.SimpleSchemaTypes.Environment[]> {
    const environments = await this.client.environments.list();

    this.printTable(
      environments,
      ['id', 'meta.primary'],
      ['meta.status', 'meta.created_at', 'meta.last_data_change_at'],
    );

    return environments;
  }
}

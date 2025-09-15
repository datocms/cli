import { type CmaClient, CmaClientCommand } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand {
  static aliases = ['environments:index', 'environments:list'];

  static description = 'Lists primary/sandbox environments of a project';

  async run(): Promise<CmaClient.ApiTypes.Environment[]> {
    const environments = await this.client.environments.list();

    this.printTable(environments, ['id', 'meta.primary']);

    return environments;
  }
}

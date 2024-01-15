import { CmaClient, CmaClientCommand } from '@datocms/cli-utils';

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Returns the name the primary environment of a project';

  async run(): Promise<CmaClient.SimpleSchemaTypes.Environment> {
    const environments = await this.client.environments.list();
    const primary = environments.find((e) => e.meta.primary)!;

    this.log(primary.id);

    return primary;
  }
}

import { BaseCommand } from '@datocms/cli-utils';

export default class Command extends BaseCommand<typeof Command.flags> {
  static description = 'Imports a Wordpress site into a DatoCMS project';

  static flags = {
    ...BaseCommand.flags,
  };

  async run(): Promise<void> {
    this.log('Eccoci!');
  }
}

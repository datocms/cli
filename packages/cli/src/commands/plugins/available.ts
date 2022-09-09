import { BaseCommand, oclif } from '@datocms/cli-utils';

type AvailablePlugin = {
  package: string;
  description: string;
};

type MaybeInstalledPlugin = AvailablePlugin & {
  installed: boolean;
};

export default class Command extends BaseCommand<typeof Command.flags> {
  static description = 'Lists official DatoCMS CLI plugins';

  static flags = {
    ...BaseCommand.flags,
    ...oclif.CliUx.ux.table.flags(),
  };

  static availablePlugins: AvailablePlugin[] = [
    {
      package: '@datocms/cli-plugin-wordpress',
      description: 'Import a WordPress site into DatoCMS',
    },
    {
      package: '@datocms/cli-plugin-contentful',
      description: 'Import a Contentful site into DatoCMS',
    },
  ];

  async run(): Promise<MaybeInstalledPlugin[]> {
    const installedPlugins = this.config.plugins;

    const maybeInstalled = Command.availablePlugins.map((p) => ({
      ...p,
      installed: installedPlugins.some((ip) => ip.name === p.package),
    }));

    this.printTable(
      maybeInstalled,
      ['package', 'description', 'installed'],
      [],
    );

    return maybeInstalled;
  }
}

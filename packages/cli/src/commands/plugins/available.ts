import { BaseCommand } from '@datocms/cli-utils';

type AvailablePlugin = {
  package: string;
  description: string;
};

type MaybeInstalledPlugin = AvailablePlugin & {
  installed: boolean;
};

export default class Command extends BaseCommand {
  static description = 'Lists official DatoCMS CLI plugins';

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

    const maybeInstalled = Command.availablePlugins.map((availablePlugin) => ({
      ...availablePlugin,
      installed: Array.from(installedPlugins.values()).some(
        (installedPlugin) => installedPlugin.name === availablePlugin.package,
      ),
    }));

    this.printTable(maybeInstalled, ['package', 'description', 'installed']);

    return maybeInstalled;
  }
}

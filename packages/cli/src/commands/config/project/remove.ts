import { BaseCommand, readConfig, Config } from '@datocms/cli-utils';
import { Flags } from '@oclif/core';
import { resolve } from 'path';
import { writeFile } from 'fs/promises';

export default class Command extends BaseCommand<typeof Command.flags> {
  static description = 'Removes project from DatoCMS config file';

  static flags = {
    ...BaseCommand.flags,
    'config-file': Flags.string({
      description: 'Specify a custom config file',
      env: 'DATOCMS_CONFIG_FILE',
      default: './datocms.config.json',
    }),
  };

  static args = [
    {
      name: 'PROJECT_ID',
      description: 'The name of the project',
      default: 'default',
    },
  ];

  async run(): Promise<void> {
    const { PROJECT_ID: projectId } = this.parsedArgs;

    const configPath = resolve(process.cwd(), this.parsedFlags['config-file']);
    const config = (await readConfig(configPath)) || { projects: {} };

    if (!config) {
      this.log(
        `Config file not present in ${configPath}, will be created from scratch`,
      );
    }

    if (!(projectId in config.projects)) {
      this.log(`Config file does not contain project "${projectId}"`);
    }

    const newConfig: Config = {
      ...config,
      projects: Object.fromEntries(
        Object.entries(config.projects).filter(([key]) => key !== projectId),
      ),
    };

    this.startSpinner(`Writing ${configPath}`);
    await writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    this.stopSpinner();
  }
}

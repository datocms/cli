import { Flags } from '@oclif/core';
import { Config, readConfig } from './config';
import { resolve } from 'path';
import { writeFile } from 'fs/promises';
import { BaseCommand } from './base-command';

export abstract class DatoConfigCommand<
  T extends typeof DatoConfigCommand.flags,
> extends BaseCommand<T> {
  static flags = {
    ...BaseCommand.flags,
    'config-file': Flags.string({
      description: 'Specify a custom config file path',
      env: 'DATOCMS_CONFIG_FILE',
      default: './datocms.config.json',
    }),
  };

  protected datoConfigPath!: string;
  protected datoConfig?: Config;

  protected async init(): Promise<void> {
    await super.init();

    this.datoConfigPath = resolve(
      process.cwd(),
      this.parsedFlags['config-file'],
    );

    this.datoConfig = await readConfig(this.datoConfigPath);
  }

  protected requireDatoConfig(): void {
    if (!this.datoConfig) {
      this.error(`No config file found in ${this.datoConfigPath}`);
    }
  }

  protected async saveDatoConfig(config: Config): Promise<void> {
    this.startSpinner(`Writing ${this.datoConfigPath}`);

    await writeFile(
      this.datoConfigPath,
      JSON.stringify(config, null, 2),
      'utf-8',
    );

    this.stopSpinner();
  }
}

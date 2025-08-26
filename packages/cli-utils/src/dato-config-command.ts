import { writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { Flags } from '@oclif/core';
import { BaseCommand } from './base-command';
import { type Config, readConfig } from './config';

export abstract class DatoConfigCommand extends BaseCommand {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    'config-file': Flags.string({
      description: 'Specify a custom config file path',
      env: 'DATOCMS_CONFIG_FILE',
      default: './datocms.config.json',
      helpGroup: 'GLOBAL',
    }),
  };

  protected datoConfigPath!: string;
  protected datoConfigRelativePath!: string;
  protected datoConfig?: Config;

  protected async init(): Promise<void> {
    await super.init();

    const { flags } = await this.parse(this.ctor as typeof DatoConfigCommand);

    this.datoConfigPath = resolve(process.cwd(), flags['config-file']);

    this.datoConfigRelativePath = relative(process.cwd(), this.datoConfigPath);

    this.datoConfig = await readConfig(this.datoConfigPath);
  }

  protected requireDatoConfig(): void {
    if (!this.datoConfig) {
      this.error(`No config file found in "${this.datoConfigRelativePath}"`, {
        suggestions: [
          `Configure a local configuration profile with "${this.config.bin} profile:set"`,
        ],
      });
    }
  }

  protected async saveDatoConfig(config: Config): Promise<void> {
    this.startSpinner(`Writing "${this.datoConfigRelativePath}"`);

    try {
      await writeFile(
        this.datoConfigPath,
        JSON.stringify(config, null, 2),
        'utf-8',
      );

      this.stopSpinner();
    } catch (e) {
      this.stopSpinnerWithFailure();

      throw e;
    }
  }
}

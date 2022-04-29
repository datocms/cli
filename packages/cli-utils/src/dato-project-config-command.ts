import { Flags } from '@oclif/core';
import { ProjectConfig } from './config';
import { DatoConfigCommand } from './dato-config-command';

export abstract class DatoProjectConfigCommand<
  T extends typeof DatoProjectConfigCommand.flags,
> extends DatoConfigCommand<T> {
  static flags = {
    ...DatoConfigCommand.flags,
    project: Flags.string({
      description: 'Use settings of project in datocms.config.js',
      env: 'DATOCMS_PROJECT',
    }),
  };

  protected datoProjectConfig?: ProjectConfig;

  protected async init(): Promise<void> {
    await super.init();

    if (this.parsedFlags.project) {
      if (!this.datoConfig) {
        this.error(
          `Requested project "${this.parsedFlags.project}" but cannot find config file`,
          {
            suggestions: [
              'Create a config file with the project with config:set command',
            ],
          },
        );
      }

      if (!(this.parsedFlags.project in this.datoConfig.projects)) {
        this.error(
          `Requested project "${this.parsedFlags.project}" is not defined in config file`,
          {
            suggestions: ['Add the project with config:set command'],
          },
        );
      }
    }

    const project = this.parsedFlags.project || 'default';

    this.datoProjectConfig =
      this.datoConfig && project in this.datoConfig.projects
        ? this.datoConfig.projects[project]
        : undefined;
  }

  protected requireDatoProjectConfig(): void {
    this.requireDatoConfig();

    if (!this.datoProjectConfig) {
      this.error('No project specified!', {
        suggestions: [
          'Provide the --project option or specify a DATOCMS_PROJECT env variable',
        ],
      });
    }
  }
}

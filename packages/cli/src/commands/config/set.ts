import {
  DatoConfigCommand,
  oclif,
  ProjectConfig,
  logLevelOptions,
  LogLevelFlagEnum,
} from '@datocms/cli-utils';
import { camelCase } from 'lodash';
import { relative } from 'path';

export default class Command extends DatoConfigCommand<typeof Command.flags> {
  static description = 'Add/update project settings in DatoCMS config file';

  static flags = {
    ...DatoConfigCommand.flags,
    project: oclif.Flags.string({
      description: 'Local name for the project',
    }),
    'api-token': oclif.Flags.string({
      description: 'API token for the project',
      env: 'DATOCMS_API_TOKEN',
    }),
    'log-level': oclif.Flags.enum<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging to use for the project',
    }),
    'migrations-dir': oclif.Flags.string({
      description: 'Directory where script migrations will be stored',
    }),
    'base-url': oclif.Flags.string({ hidden: true }),
  };

  async run(): Promise<void> {
    if (!this.datoConfig) {
      this.log(
        `Config file not present in ${this.datoConfigRelativePath}, will be created from scratch`,
      );
    }

    const projectId =
      this.parsedFlags.project ||
      (await oclif.CliUx.ux.prompt('Local name to give to the project', {
        default:
          this.datoConfig && 'default' in this.datoConfig.projects
            ? undefined
            : 'default',
        required: true,
      }));

    let existingProjectConfig: ProjectConfig | undefined;

    if (this.datoConfig && projectId in this.datoConfig.projects) {
      existingProjectConfig = this.datoConfig.projects[projectId];
      this.log(
        `Config file already has project "${projectId}", existing settings will be overridden`,
      );
    }

    const apiToken =
      this.parsedFlags['api-token'] ||
      (await oclif.CliUx.ux.prompt('API token for the project', {
        type: 'mask',
        default: existingProjectConfig?.apiToken,
        required: true,
      }));

    const logLevel =
      this.parsedFlags['api-token'] ||
      (await oclif.CliUx.ux.prompt(
        `Level of logging to use for the project (${logLevelOptions.join(
          ', ',
        )})`,
        {
          default: existingProjectConfig?.logLevel || 'NONE',
          required: true,
        },
      ));

    const migrationsDir =
      this.parsedFlags['migrations-dir'] ||
      (await oclif.CliUx.ux.prompt(
        `Directory where script migrations will be stored`,
        {
          default:
            existingProjectConfig?.migrationsDir ||
            (Object.keys(this.datoConfig?.projects || {}).length -
              (existingProjectConfig ? 1 : 0) ===
            0
              ? './migrations'
              : camelCase(`./${projectId} migrations`)),
          required: true,
        },
      ));

    this.saveDatoConfig({
      ...this.datoConfig,
      projects: {
        ...this.datoConfig?.projects,
        [projectId]: {
          ...this.datoConfig?.projects[projectId],
          apiToken,
          logLevel,
          migrationsDir,
        },
      },
    });
  }
}

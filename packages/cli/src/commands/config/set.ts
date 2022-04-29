import {
  DatoConfigCommand,
  ProjectConfig,
  logLevelOptions,
  LogLevelFlagEnum,
  oclif,
} from '@datocms/cli-utils';
import { camelCase } from 'lodash';

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
    'migrations-model': oclif.Flags.string({
      description: 'API key of the DatoCMS model used to store migration data',
    }),
    'base-url': oclif.Flags.string({ hidden: true }),
  };

  async run(): Promise<void> {
    if (!this.datoConfig) {
      this.log(
        `Config file not present in "${this.datoConfigRelativePath}", will be created from scratch`,
      );
    }

    const projectId =
      this.parsedFlags.project ||
      (await oclif.CliUx.ux.prompt(
        'Please insert the name of the project you want to setup or update',
        {
          default:
            this.datoConfig && Object.keys(this.datoConfig.projects).length > 0
              ? Object.keys(this.datoConfig.projects)[0]
              : 'default',
          required: true,
        },
      ));

    let existingProjectConfig: ProjectConfig | undefined;

    if (this.datoConfig && projectId in this.datoConfig.projects) {
      existingProjectConfig = this.datoConfig.projects[projectId];
      this.log(
        `Config file already has project "${projectId}", existing settings will be overridden`,
      );
    }

    const apiToken: string | undefined =
      this.parsedFlags['api-token'] ||
      (await oclif.CliUx.ux.prompt('API token for the project', {
        type: 'mask',
        default: existingProjectConfig?.apiToken,
        required: false,
      })) ||
      undefined;

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
            existingProjectConfig?.migrations?.directory ||
            (Object.keys(this.datoConfig?.projects || {}).length -
              (existingProjectConfig ? 1 : 0) ===
            0
              ? './migrations'
              : `./${camelCase(`${projectId} migrations`)}`),
          required: true,
        },
      ));

    const migrationModelApiKey =
      this.parsedFlags['migrations-model'] ||
      (await oclif.CliUx.ux.prompt(
        `API key of the DatoCMS model used to store migration data`,
        {
          default:
            existingProjectConfig?.migrations?.modelApiKey ||
            'schema_migration',
          required: true,
        },
      ));

    await this.saveDatoConfig({
      ...this.datoConfig,
      projects: {
        ...this.datoConfig?.projects,
        [projectId]: {
          ...this.datoConfig?.projects[projectId],
          apiToken,
          logLevel,
          migrations: {
            directory: migrationsDir,
            modelApiKey: migrationModelApiKey,
          },
        },
      },
    });
  }
}

import {
  DatoConfigCommand,
  ProfileConfig,
  logLevelOptions,
  LogLevelFlagEnum,
  oclif,
} from '@datocms/cli-utils';
import { camelCase } from 'lodash';

export default class Command extends DatoConfigCommand<typeof Command.flags> {
  static description =
    'Add/update profile configuration in DatoCMS config file';

  static args = [
    {
      name: 'PROFILE_ID',
      description: 'Name of the profile to create/update',
      default: 'default',
      required: true,
    },
  ];

  static flags = {
    ...DatoConfigCommand.flags,
    'log-level': oclif.Flags.enum<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging to use for the profile',
    }),
    'migrations-dir': oclif.Flags.string({
      description: 'Directory where script migrations will be stored',
    }),
    'migrations-model': oclif.Flags.string({
      description: 'API key of the DatoCMS model used to store migration data',
    }),
    'migrations-template': oclif.Flags.string({
      description: 'Path of the file to use as migration script template',
    }),
    'base-url': oclif.Flags.string({ hidden: true }),
  };

  async run(): Promise<void> {
    if (!this.datoConfig) {
      this.log(
        `Config file not present in "${this.datoConfigRelativePath}", will be created from scratch`,
      );
    }

    const profileId = this.parsedArgs.PROFILE_ID;

    this.log(`Requested to configure profile "${profileId}"`);

    let existingProfileConfig: ProfileConfig | undefined;

    if (this.datoConfig && profileId in this.datoConfig.profiles) {
      existingProfileConfig = this.datoConfig.profiles[profileId];
      this.log(
        `Config file already has profile "${profileId}", existing settings will be overridden`,
      );
    }

    this.log();

    const logLevel =
      this.parsedFlags['log-level'] ||
      (await oclif.CliUx.ux.prompt(
        `* Level of logging to use for the profile (${logLevelOptions.join(
          ', ',
        )})`,
        {
          default: existingProfileConfig?.logLevel || 'NONE',
          required: true,
        },
      ));

    const migrationsDir =
      this.parsedFlags['migrations-dir'] ||
      (await oclif.CliUx.ux.prompt(
        `* Directory where script migrations will be stored`,
        {
          default:
            existingProfileConfig?.migrations?.directory ||
            (Object.keys(this.datoConfig?.profiles || {}).length -
              (existingProfileConfig ? 1 : 0) ===
            0
              ? './migrations'
              : `./${camelCase(`${profileId} migrations`)}`),
          required: true,
        },
      ));

    const migrationModelApiKey =
      this.parsedFlags['migrations-model'] ||
      (await oclif.CliUx.ux.prompt(
        `* API key of the DatoCMS model used to store migration data`,
        {
          default:
            existingProfileConfig?.migrations?.modelApiKey ||
            'schema_migration',
          required: true,
        },
      ));

    const migrationTemplate =
      this.parsedFlags['migrations-template'] ||
      (await oclif.CliUx.ux.prompt(
        `* Path of the file to use as migration script template (optional)`,
        {
          default: existingProfileConfig?.migrations?.template,
          required: false,
        },
      ));

    await this.saveDatoConfig({
      ...this.datoConfig,
      profiles: {
        ...this.datoConfig?.profiles,
        [profileId]: {
          ...this.datoConfig?.profiles[profileId],
          logLevel,
          migrations: {
            directory: migrationsDir,
            modelApiKey: migrationModelApiKey,
            template: migrationTemplate,
          },
        },
      },
    });
  }
}

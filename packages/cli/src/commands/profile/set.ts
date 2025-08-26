import {
  DatoConfigCommand,
  type LogLevelFlagEnum,
  type ProfileConfig,
  logLevelOptions,
  oclif,
} from '@datocms/cli-utils';
import { input, select } from '@inquirer/prompts';
import { camelCase } from 'lodash';

export default class Command extends DatoConfigCommand {
  static description =
    'Add/update profile configuration in DatoCMS config file';

  static args = {
    PROFILE_ID: oclif.Args.string({
      description: 'Name of the profile to create/update',
      default: 'default',
      required: true,
    }),
  };

  static flags = {
    'log-level': oclif.Flags.custom<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging to use for the profile',
    })(),
    'migrations-dir': oclif.Flags.string({
      description: 'Directory where script migrations will be stored',
    }),
    'migrations-model': oclif.Flags.string({
      description: 'API key of the DatoCMS model used to store migration data',
    }),
    'migrations-template': oclif.Flags.string({
      description: 'Path of the file to use as migration script template',
    }),
    'migrations-tsconfig': oclif.Flags.string({
      description:
        'Path of the tsconfig.json to use to run TS migration scripts',
    }),
    'base-url': oclif.Flags.string({ hidden: true }),
  };

  async run(): Promise<void> {
    const {
      args: { PROFILE_ID: profileId },
      flags,
    } = await this.parse(Command);

    if (!this.datoConfig) {
      this.log(
        `Config file not present in "${this.datoConfigRelativePath}", will be created from scratch`,
      );
    }

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
      flags['log-level'] ||
      (await select({
        message: `* Level of logging to use for the profile (${logLevelOptions.join(
          ', ',
        )})`,
        default: existingProfileConfig?.logLevel || 'NONE',
        choices: logLevelOptions.map((option) => ({
          name: option,
          value: option,
        })),
      }));

    const migrationsDir =
      flags['migrations-dir'] ||
      (await input({
        message: '* Directory where script migrations will be stored',
        default:
          existingProfileConfig?.migrations?.directory ||
          (Object.keys(this.datoConfig?.profiles || {}).length -
            (existingProfileConfig ? 1 : 0) ===
          0
            ? './migrations'
            : `./${camelCase(`${profileId} migrations`)}`),
        required: true,
      }));

    const migrationModelApiKey =
      flags['migrations-model'] ||
      (await input({
        message: '* API key of the DatoCMS model used to store migration data',
        default:
          existingProfileConfig?.migrations?.modelApiKey || 'schema_migration',
        required: true,
      }));

    const migrationTemplate =
      flags['migrations-template'] ||
      (await input({
        message:
          '* Path of the file to use as migration script template (optional)',
        default: existingProfileConfig?.migrations?.template,
        required: false,
      }));

    const migrationTsconfig =
      flags['migrations-tsconfig'] ||
      (await input({
        message:
          '* Path of the tsconfig.json to use to run TS migration scripts (optional)',
        default: existingProfileConfig?.migrations?.tsconfig,
        required: false,
      }));

    const newProfileConfig: ProfileConfig = {
      ...this.datoConfig?.profiles[profileId],
      logLevel,
      migrations: {
        directory: migrationsDir,
        modelApiKey: migrationModelApiKey,
        template: migrationTemplate,
        tsconfig: migrationTsconfig,
      },
    };

    await this.saveDatoConfig({
      ...this.datoConfig,
      profiles: {
        ...this.datoConfig?.profiles,
        [profileId]: newProfileConfig,
      },
    });
  }
}

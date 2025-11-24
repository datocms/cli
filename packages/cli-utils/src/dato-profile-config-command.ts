import { Flags } from '@oclif/core';
import type { ProfileConfig } from './config';
import { DatoConfigCommand } from './dato-config-command';

export abstract class DatoProfileConfigCommand extends DatoConfigCommand {
  static baseFlags = {
    ...DatoConfigCommand.baseFlags,
    profile: Flags.string({
      description: 'Use settings of profile in datocms.config.js',
      env: 'DATOCMS_PROFILE',
      helpGroup: 'GLOBAL',
    }),
  };

  protected datoProfileConfig?: ProfileConfig;
  protected profileId!: string;

  protected async init(): Promise<void> {
    await super.init();

    const { flags } = await this.parse(
      this.ctor as typeof DatoProfileConfigCommand,
    );

    if (flags.profile) {
      if (!this.datoConfig) {
        this.error(
          `Requested profile "${flags.profile}" but cannot find config file`,
          {
            suggestions: [
              `Create profile with "${this.config.bin} profile:set ${flags.profile}"`,
            ],
          },
        );
      }

      if (!(flags.profile in this.datoConfig.profiles)) {
        this.error(
          `Requested profile "${flags.profile}" is not defined in config file "${this.datoConfigRelativePath}"`,
          {
            suggestions: [
              `Configure it with "${this.config.bin} profile:set ${flags.profile}"`,
            ],
          },
        );
      }
    } else if (
      this.datoConfig &&
      Object.keys(this.datoConfig.profiles).length > 1
    ) {
      this.error(
        `Multiple profiles detected in config file "${this.datoConfigRelativePath}"`,
        {
          suggestions: [
            `Specify which profile to use with the "--profile" flag, or the DATOCMS_PROFILE env variable (we look inside .env.local and .env too)`,
          ],
        },
      );
    }

    this.profileId = flags.profile || 'default';

    this.datoProfileConfig =
      this.datoConfig && this.profileId in this.datoConfig.profiles
        ? this.datoConfig.profiles[this.profileId]
        : undefined;
  }

  protected requireDatoProfileConfig(): void {
    this.requireDatoConfig();

    if (!this.datoProfileConfig) {
      this.error('No profile specified!', {
        suggestions: [
          'Provide the --profile option or specify a DATOCMS_PROFILE env variable',
        ],
      });
    }
  }
}

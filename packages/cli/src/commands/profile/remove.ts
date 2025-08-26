import { DatoConfigCommand, oclif } from '@datocms/cli-utils';
export default class Command extends DatoConfigCommand {
  static description = 'Remove a profile from DatoCMS config file';

  static args = {
    PROFILE_ID: oclif.Args.string({
      description: 'The name of the profile',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const {
      args: { PROFILE_ID: profileId },
    } = await this.parse(Command);

    if (!this.datoConfig) {
      this.log(
        `Config file not present in "${this.datoConfigRelativePath}", skipping operation`,
      );
      return;
    }

    if (!(profileId in this.datoConfig.profiles)) {
      this.log(
        `Config file does not contain profile "${profileId}", skipping operation`,
      );
      return;
    }

    await this.saveDatoConfig({
      ...this.datoConfig,
      profiles: Object.fromEntries(
        Object.entries(this.datoConfig?.profiles || {}).filter(
          ([key]) => key !== profileId,
        ),
      ),
    });
  }
}

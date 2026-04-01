import { DatoConfigCommand, oclif } from '@datocms/cli-utils';

export default class Command extends DatoConfigCommand {
  static hiddenAliases = ['profile:remove'];

  static description = 'Unlink the current directory from a DatoCMS project';

  static flags = {
    profile: oclif.Flags.string({
      description: 'Name of the profile to remove',
      default: 'default',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Command);

    const profileId = flags.profile;

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

import { DatoConfigCommand } from '@datocms/cli-utils';
export default class Command extends DatoConfigCommand<typeof Command.flags> {
  static description = 'Remove a profile from DatoCMS config file';

  static args = [
    {
      name: 'PROFILE_ID',
      description: 'The name of the profile',
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { PROFILE_ID: profileId } = this.parsedArgs;

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

import { DatoConfigCommand } from '@datocms/cli-utils';
export default class Command extends DatoConfigCommand<typeof Command.flags> {
  static description = 'Remove a project from DatoCMS config file';

  static args = [
    {
      name: 'PROJECT_ID',
      description: 'The name of the project',
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { PROJECT_ID: projectId } = this.parsedArgs;

    if (!this.datoConfig) {
      this.log(
        `Config file not present in ${this.datoConfigPath}, skipping operation`,
      );
      return;
    }

    if (!(projectId in this.datoConfig.projects)) {
      this.log(
        `Config file does not contain project "${projectId}", skipping operation`,
      );
      return;
    }

    await this.saveDatoConfig({
      ...this.datoConfig,
      projects: Object.fromEntries(
        Object.entries(this.datoConfig?.projects || {}).filter(
          ([key]) => key !== projectId,
        ),
      ),
    });
  }
}

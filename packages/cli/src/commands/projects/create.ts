import {
  DashboardClient,
  DashboardClientCommand,
  oclif,
} from '@datocms/cli-utils';

export default class Command extends DashboardClientCommand<
  typeof Command.flags
> {
  static description =
    'Creates a new blank project or a copy of a DatoCMS template';

  static args = [
    {
      name: 'NEW_PROJECT_NAME',
      description: 'The name of the new project to generate',
      required: true,
    },
  ];

  static flags = {
    ...DashboardClientCommand.flags,
    'internal-subdomain': oclif.Flags.string({
      description:
        'Specify the internal subdomain of your new project. If not specified a slugified version of the project name will be set',
    }),
    'template-id': oclif.Flags.string({
      description:
        'The ID of the DatoCMS project you want to use as template. You can find the template ID in the datocms.json file of the template project',
    }),
  };

  async run(): Promise<DashboardClient.SimpleSchemaTypes.Site> {
    const { NEW_PROJECT_NAME: projectName } = this.parsedArgs;

    const { 'internal-subdomain': internalSubdomain, 'template-id': template } =
      this.parsedFlags;

    try {
      this.startSpinner(`Creating a project called "${projectName}"`);

      const project = await this.dashboardClient.sites.create({
        name: projectName,
        internal_subdomain: internalSubdomain,
        template,
      });

      this.stopSpinner();

      return project;
    } catch (e) {
      if (
        e instanceof DashboardClient.ApiError &&
        e.findError('INVALID_FIELD', {
          field: 'name',
          code: 'VALIDATION_UNIQUENESS',
        })
      ) {
        this.error(`A project called "${projectName}" already exists`, {
          suggestions: ['Choose another name'],
        });
      }

      throw e;
    }
  }
}

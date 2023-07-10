import {
  DashboardClient,
  DashboardClientCommand,
  oclif,
} from '@datocms/cli-utils';

export default class Command extends DashboardClientCommand<
  typeof Command.flags
> {
  static description =
    'Lists all projects belonging to one account or organization';

  static flags = {
    ...DashboardClientCommand.flags,
    ...oclif.CliUx.ux.table.flags(),
  };

  async run(): Promise<DashboardClient.SimpleSchemaTypes.Site[]> {
    const projects = await this.dashboardClient.sites.list();

    this.printTable(
      projects,
      [
        'id',
        'name',
        'domain',
        'internal_domain',
        'internal_subdomain',
        'status',
        'deactivated',
        'created_at',
        'last_data_change_at',
      ],
      ['readonly_token'],
    );

    return projects;
  }
}

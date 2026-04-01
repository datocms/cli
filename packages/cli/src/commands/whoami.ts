import { BaseCommand, readCredentials } from '@datocms/cli-utils';
import { buildClient } from '@datocms/dashboard-client';
import chalk from 'chalk';

export default class Whoami extends BaseCommand {
  static description = 'Show the currently authenticated DatoCMS account';

  static examples = ['<%= config.bin %> whoami'];

  async run(): Promise<void> {
    const credentials = await readCredentials();

    if (!credentials) {
      this.error('Not logged in.', {
        suggestions: ['Run "datocms login" to authenticate'],
      });
    }

    const client = buildClient({
      apiToken: credentials.apiToken,
      ...(credentials.dashboardBaseUrl
        ? { baseUrl: credentials.dashboardBaseUrl }
        : {}),
    });

    const account = await client.account.find();

    this.log();
    this.log(`  ${chalk.bold('Email:')}      ${account.email}`);

    if (account.first_name || account.last_name) {
      this.log(
        `  ${chalk.bold('Name:')}       ${[
          account.first_name,
          account.last_name,
        ]
          .filter(Boolean)
          .join(' ')}`,
      );
    }

    if (account.company) {
      this.log(`  ${chalk.bold('Company:')}    ${account.company}`);
    }

    this.log();
  }
}

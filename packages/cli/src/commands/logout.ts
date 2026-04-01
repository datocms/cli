import { BaseCommand, deleteCredentials } from '@datocms/cli-utils';
import chalk from 'chalk';

export default class Logout extends BaseCommand {
  static description = 'Log out of DatoCMS by removing stored credentials';

  static examples = ['<%= config.bin %> logout'];

  async run(): Promise<void> {
    await deleteCredentials();
    this.log(chalk.green('Logged out successfully.'));
  }
}

import {
  BaseCommand,
  deleteCredentials,
  readCredentials,
  revokeOAuthToken,
} from '@datocms/cli-utils';
import chalk from 'chalk';

export default class Logout extends BaseCommand {
  static description = 'Log out of DatoCMS by removing stored credentials';

  static examples = ['<%= config.bin %> logout'];

  async run(): Promise<void> {
    const credentials = await readCredentials();

    if (credentials) {
      try {
        await revokeOAuthToken(credentials.apiToken);
      } catch {
        this.log(
          chalk.yellow(
            'Could not revoke the OAuth token remotely. Removing local credentials anyway.',
          ),
        );
      }
    }

    await deleteCredentials();
    this.log(chalk.green('Logged out successfully.'));
  }
}

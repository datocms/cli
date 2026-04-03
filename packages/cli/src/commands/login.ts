import {
  BaseCommand,
  oclif,
  performOAuthLogin,
  readCredentials,
  saveCredentials,
} from '@datocms/cli-utils';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';

export default class Login extends BaseCommand {
  static description = 'Authenticate with DatoCMS via OAuth';

  static examples = ['<%= config.bin %> login'];

  static flags = {
    'oauth-base-url': oclif.Flags.string({ hidden: true }),
    'dashboard-base-url': oclif.Flags.string({ hidden: true }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);

    const existing = await readCredentials();

    if (existing) {
      this.log(
        chalk.yellow(
          'You are already logged in. Proceeding will replace your existing credentials.\n',
        ),
      );
    }

    const accessToken = await performOAuthLogin({
      oauthBaseUrl: flags['oauth-base-url'],
      onListening: () => {
        this.log('Opening browser for authentication...');
      },
      onOobFallback: () => {
        this.log(
          chalk.yellow(
            'Port 7651 is in use. Falling back to manual authentication.',
          ),
        );
      },
      openBrowser: async (url) => {
        const { default: open } = await import('open');
        await open(url);
      },
      promptForUrl: async (authorizeUrl) => {
        this.log();
        this.log('Open this URL in your browser to authenticate:');
        this.log();
        this.log(chalk.cyan(authorizeUrl));
        this.log();
        this.log(
          'After authorizing, your browser will redirect to a page that may not load.',
        );
        this.log(
          "Copy the full URL from your browser's address bar and paste it below.",
        );
        this.log();

        return input({ message: 'Paste the redirect URL:' });
      },
    });

    await saveCredentials({
      apiToken: accessToken,
      dashboardBaseUrl: flags['dashboard-base-url'],
    });

    this.log();
    this.log(chalk.green('Login successful! Credentials saved.'));
  }
}

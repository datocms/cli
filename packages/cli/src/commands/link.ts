import {
  type Credentials,
  DatoConfigCommand,
  type LogLevelFlagEnum,
  type ProfileConfig,
  logLevelOptions,
  oclif,
  performOAuthLogin,
  readCredentials,
  saveCredentials,
} from '@datocms/cli-utils';
import { buildClient } from '@datocms/dashboard-client';
import { input, search, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { camelCase } from 'lodash';

type AuthMethod = 'keep' | 'relink' | 'env-var';

export default class Command extends DatoConfigCommand {
  static hiddenAliases = ['profile:set'];

  static description =
    'Link the current directory to a DatoCMS project and configure it';

  static flags = {
    profile: oclif.Flags.string({
      description: 'Name of the profile to create/update',
      default: 'default',
    }),
    'log-level': oclif.Flags.custom<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging to use for the profile',
    })(),
    'migrations-dir': oclif.Flags.string({
      description: 'Directory where script migrations will be stored',
    }),
    'migrations-model': oclif.Flags.string({
      description: 'API key of the DatoCMS model used to store migration data',
    }),
    'migrations-template': oclif.Flags.string({
      description: 'Path of the file to use as migration script template',
    }),
    'migrations-tsconfig': oclif.Flags.string({
      description:
        'Path of the tsconfig.json to use to run TS migration scripts',
    }),
    'organization-id': oclif.Flags.string({
      description: 'Organization ID to use',
    }),
    'site-id': oclif.Flags.string({
      description: 'Site ID to link to',
    }),
    'base-url': oclif.Flags.string({ hidden: true }),
    'oauth-base-url': oclif.Flags.string({ hidden: true }),
    'dashboard-base-url': oclif.Flags.string({ hidden: true }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Command);

    const profileId = flags.profile;
    const interactive = Boolean(process.stdin.isTTY);

    if (!this.datoConfig) {
      this.log(
        `Config file not present in "${this.datoConfigRelativePath}", will be created from scratch`,
      );
    }

    if (profileId !== 'default') {
      this.log(`Configuring profile "${profileId}"`);
    }

    let existingProfileConfig: ProfileConfig | undefined;

    if (this.datoConfig && profileId in this.datoConfig.profiles) {
      existingProfileConfig = this.datoConfig.profiles[profileId];
      this.log(
        `Config file already has profile "${profileId}", existing settings will be overridden`,
      );
    }

    this.log();

    // Authentication step
    let siteId: string | undefined =
      flags['site-id'] || existingProfileConfig?.siteId;
    let organizationId: string | undefined =
      flags['organization-id'] || existingProfileConfig?.organizationId;
    let apiTokenEnvName: string | undefined =
      existingProfileConfig?.apiTokenEnvName;

    let credentials = await readCredentials();

    if (flags['site-id']) {
      if (!credentials) {
        if (!interactive) {
          this.error(
            'Not logged in, and OAuth login requires an interactive terminal.',
            {
              suggestions: [
                'Run "datocms login" in a terminal first, then retry this command',
              ],
            },
          );
        }
        credentials = await this.performLogin(flags);
      }

      await this.validateProject(
        credentials,
        flags['site-id'],
        flags['organization-id'],
      );
    } else {
      if (!interactive) {
        this.error(
          'Running in a non-interactive shell and no --site-id was provided.',
          {
            suggestions: [
              'Pass --site-id=<ID> (and --organization-id=<ID> if needed) to skip the project selection prompt',
              'Run the command in an interactive terminal to pick a project via browser login',
            ],
          },
        );
      }

      // Resolve current project name for display
      let currentProjectName: string | undefined;

      if (existingProfileConfig?.siteId && credentials) {
        currentProjectName = await this.resolveProjectName(
          credentials,
          existingProfileConfig.siteId,
          existingProfileConfig.organizationId,
        );
      }

      const authMethod = await this.askAuthMethod(
        existingProfileConfig,
        currentProjectName,
      );

      if (authMethod === 'relink') {
        if (!credentials) {
          credentials = await this.performLogin(flags);
        }

        const result = await this.selectProject(credentials);
        siteId = result.siteId;
        organizationId = result.organizationId;
      } else if (authMethod === 'env-var') {
        siteId = undefined;
        organizationId = undefined;

        const defaultEnvName =
          profileId === 'default'
            ? 'DATOCMS_API_TOKEN'
            : `DATOCMS_${profileId.toUpperCase()}_PROFILE_API_TOKEN`;

        apiTokenEnvName = await input({
          message: '* Environment variable name for the API token',
          default: existingProfileConfig?.apiTokenEnvName || defaultEnvName,
          required: true,
        });

        if (apiTokenEnvName === defaultEnvName) {
          apiTokenEnvName = undefined;
        }

        this.log();
        this.log(
          chalk.dim(
            `  Make sure to set ${
              apiTokenEnvName || defaultEnvName
            } in your environment, .env or .env.local file.`,
          ),
        );
        this.log();
      }
    }

    const logLevelDefault = existingProfileConfig?.logLevel || 'NONE';
    const logLevel =
      flags['log-level'] ??
      (interactive
        ? await select({
            message: `* Level of logging to use for the profile (${logLevelOptions.join(
              ', ',
            )})`,
            default: logLevelDefault,
            choices: logLevelOptions.map((option) => ({
              name: option,
              value: option,
            })),
          })
        : logLevelDefault);

    const migrationsDirDefault =
      existingProfileConfig?.migrations?.directory ||
      (Object.keys(this.datoConfig?.profiles || {}).length -
        (existingProfileConfig ? 1 : 0) ===
      0
        ? './migrations'
        : `./${camelCase(`${profileId} migrations`)}`);
    const migrationsDir =
      flags['migrations-dir'] ??
      (interactive
        ? await input({
            message: '* Directory where script migrations will be stored',
            default: migrationsDirDefault,
            required: true,
          })
        : migrationsDirDefault);

    const migrationModelApiKeyDefault =
      existingProfileConfig?.migrations?.modelApiKey || 'schema_migration';
    const migrationModelApiKey =
      flags['migrations-model'] ??
      (interactive
        ? await input({
            message:
              '* API key of the DatoCMS model used to store migration data',
            default: migrationModelApiKeyDefault,
            required: true,
          })
        : migrationModelApiKeyDefault);

    const migrationTemplate =
      flags['migrations-template'] ??
      (interactive
        ? await input({
            message:
              '* Path of the file to use as migration script template (optional)',
            default: existingProfileConfig?.migrations?.template,
            required: false,
          })
        : existingProfileConfig?.migrations?.template);

    const migrationTsconfig =
      flags['migrations-tsconfig'] ??
      (interactive
        ? await input({
            message:
              '* Path of the tsconfig.json to use to run TS migration scripts (optional)',
            default: existingProfileConfig?.migrations?.tsconfig,
            required: false,
          })
        : existingProfileConfig?.migrations?.tsconfig);

    const newProfileConfig: ProfileConfig = {
      ...(siteId ? { siteId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(apiTokenEnvName ? { apiTokenEnvName } : {}),
      logLevel,
      migrations: {
        directory: migrationsDir,
        modelApiKey: migrationModelApiKey,
        template: migrationTemplate,
        tsconfig: migrationTsconfig,
      },
    };

    await this.saveDatoConfig({
      ...this.datoConfig,
      profiles: {
        ...this.datoConfig?.profiles,
        [profileId]: newProfileConfig,
      },
    });
  }

  private async askAuthMethod(
    existingConfig: ProfileConfig | undefined,
    currentProjectName: string | undefined,
  ): Promise<AuthMethod> {
    if (existingConfig?.siteId && currentProjectName) {
      // Already linked to a project
      return select({
        message: '* How do you want to authenticate with DatoCMS?',
        choices: [
          {
            name: `Keep current project ("${currentProjectName}")`,
            value: 'keep' as const,
          },
          {
            name: 'Link to a different project',
            value: 'relink' as const,
          },
          {
            name: 'Switch to API token via environment variable',
            value: 'env-var' as const,
          },
        ],
      });
    }

    return select({
      message: '* How do you want to authenticate to your DatoCMS project?',
      choices: [
        {
          name: 'Log in with browser and select a project',
          value: 'relink' as const,
        },
        {
          name: 'Provide an API token via environment variable',
          value: 'env-var' as const,
        },
      ],
    });
  }

  private async performLogin(flags: {
    'oauth-base-url'?: string;
    'dashboard-base-url'?: string;
  }): Promise<Credentials> {
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

    const credentials: Credentials = {
      apiToken: accessToken,
      dashboardBaseUrl: flags['dashboard-base-url'],
    };

    await saveCredentials(credentials);

    this.log(chalk.green('Login successful!'));
    this.log();

    return credentials;
  }

  private async validateProject(
    credentials: Credentials,
    siteId: string,
    organizationId?: string,
  ): Promise<void> {
    const client = buildClient({
      apiToken: credentials.apiToken,
      ...(credentials.dashboardBaseUrl
        ? { baseUrl: credentials.dashboardBaseUrl }
        : {}),
      ...(organizationId ? { organization: organizationId } : {}),
    });

    try {
      const site = await client.sites.find(siteId);
      this.log(`Linking to project "${site.name}" (ID: ${siteId})`);
    } catch {
      this.error(
        `Could not find project with ID "${siteId}".${
          organizationId
            ? ` Organization ID "${organizationId}" may also be incorrect.`
            : ''
        }`,
        {
          suggestions: [
            'Check that the project ID is correct',
            ...(organizationId
              ? ['Check that the organization ID is correct']
              : []),
            'Run "datocms link" without --site-id to select a project interactively',
          ],
        },
      );
    }
  }

  private async resolveProjectName(
    credentials: Credentials,
    siteId: string,
    organizationId?: string,
  ): Promise<string> {
    try {
      const client = buildClient({
        apiToken: credentials.apiToken,
        ...(credentials.dashboardBaseUrl
          ? { baseUrl: credentials.dashboardBaseUrl }
          : {}),
        ...(organizationId ? { organization: organizationId } : {}),
      });

      const site = await client.sites.find(siteId);

      return site.name;
    } catch {
      return `project #${siteId}`;
    }
  }

  private async selectProject(credentials: Credentials): Promise<{
    siteId: string;
    organizationId?: string;
  }> {
    const client = buildClient({
      apiToken: credentials.apiToken,
      ...(credentials.dashboardBaseUrl
        ? { baseUrl: credentials.dashboardBaseUrl }
        : {}),
    });

    const [account, organizations] = await Promise.all([
      client.account.find(),
      client.organizations.list(),
    ]);

    type WorkspaceChoice = {
      type: 'personal' | 'organization';
      organizationId?: string;
      label: string;
      sites: Array<{ id: string; name: string }>;
    };

    const allWorkspaces: Array<Omit<WorkspaceChoice, 'sites'>> = [
      {
        type: 'personal',
        label: `Personal account (${account.email})`,
      },
      ...organizations.map((org) => ({
        type: 'organization' as const,
        organizationId: org.id,
        label: org.name || `Organization ${org.id}`,
      })),
    ];

    // Fetch projects for each workspace in parallel, filtering out empty ones
    const workspaceChoices = (
      await Promise.all(
        allWorkspaces.map(async (ws) => {
          const wsClient = buildClient({
            apiToken: credentials.apiToken,
            ...(credentials.dashboardBaseUrl
              ? { baseUrl: credentials.dashboardBaseUrl }
              : {}),
            ...(ws.organizationId ? { organization: ws.organizationId } : {}),
          });

          const sites: Array<{ id: string; name: string }> = [];
          for await (const site of wsClient.sites.listPagedIterator()) {
            if (site.access_token) {
              sites.push({ id: site.id, name: site.name });
            }
          }

          return sites.length > 0 ? { ...ws, sites } : null;
        }),
      )
    ).filter((ws): ws is WorkspaceChoice => ws !== null);

    if (workspaceChoices.length === 0) {
      this.error('No projects found in any workspace.', {
        suggestions: ['Create a project at https://dashboard.datocms.com'],
      });
    }

    let selectedWorkspace: WorkspaceChoice;

    if (workspaceChoices.length === 1) {
      selectedWorkspace = workspaceChoices[0];
    } else {
      selectedWorkspace = await select({
        message: 'Select a workspace:',
        choices: workspaceChoices.map((ws) => ({
          name: ws.label,
          value: ws,
        })),
      });
    }

    const sites = selectedWorkspace.sites;

    const selectedSite = await search({
      message: 'Search for a project:',
      source: (term) => {
        const filtered = term
          ? sites.filter((s) =>
              s.name.toLowerCase().includes(term.toLowerCase()),
            )
          : sites;

        return filtered.map((site) => ({
          name: site.name,
          value: site,
        }));
      },
    });

    return {
      siteId: selectedSite.id,
      organizationId: selectedWorkspace.organizationId,
    };
  }
}

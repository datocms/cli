import {
  ApiError,
  buildClient,
  Client,
  LogLevel,
} from '@datocms/cma-client-node';
import { Flags } from '@oclif/core';
import BaseCommand from './base-command';
import { readConfig } from './config';
import { resolve } from 'path';

const logLevelMap = {
  NONE: LogLevel.NONE,
  BASIC: LogLevel.BASIC,
  BODY: LogLevel.BODY,
  BODY_AND_HEADERS: LogLevel.BODY_AND_HEADERS,
} as const;

export default abstract class ClientCommand<
  T extends typeof ClientCommand.flags,
> extends BaseCommand<T> {
  static flags = {
    ...BaseCommand.flags,
    'config-file': Flags.string({
      description: 'Specify a custom config file',
      env: 'DATOCMS_CONFIG_FILE',
      default: './datocms.config.json',
    }),
    'api-token': Flags.string({
      description: 'Specify a custom API key to access a project',
      env: 'DATOCMS_API_KEY',
    }),
    project: Flags.string({
      description:
        'Use the API key of a specific project contained in config file',
      default: 'default',
      env: 'DATOCMS_PROJECT',
    }),
    'log-level': Flags.enum<keyof typeof logLevelMap>({
      options: ['NONE', 'BASIC', 'BODY', 'BODY_AND_HEADERS'],
      description: 'Log performed API calls',
      default: 'NONE',
    }),
    'base-url': Flags.string({ hidden: true }),
  };

  protected client!: Client;

  protected async init(): Promise<void> {
    await super.init();

    const configPath = resolve(process.cwd(), this.parsedFlags['config-file']);
    const config = await readConfig(configPath);

    if (this.parsedFlags.project) {
      if (!config) {
        this.error(
          `Requested project "${this.parsedFlags.project}" but cannot find config file`,
          {
            suggestions: [
              'Create a config file with the project with config:projects:add command',
            ],
          },
        );
      }

      if (!(this.parsedFlags.project in config.projects)) {
        this.error(
          `Requested project "${this.parsedFlags.project}" is not defined in config file`,
          {
            suggestions: ['Add the project with config:projects:add command'],
          },
        );
      }
    }

    const apiToken =
      this.parsedFlags['api-token'] ||
      (config && this.parsedFlags.project in config.projects
        ? config.projects[this.parsedFlags.project].apiToken
        : undefined);

    if (!apiToken) {
      this.error(`Cannot find an API key to use to call DatoCMS!`, {
        suggestions: [
          `The API key to use is determined by looking at:
* The --apiToken flag
* The DATOCMS_API_KEY environment variable
* The settings contained in ${configPath}`,
        ],
      });
    }

    this.client = buildClient({
      apiToken,
      baseUrl: this.parsedFlags['base-url'],
      logLevel:
        this.parsedFlags.json || this.parsedFlags.output
          ? LogLevel.NONE
          : logLevelMap[this.parsedFlags['log-level']],
    });
  }

  protected async catch(
    err: Error & { exitCode?: number | undefined },
  ): Promise<void> {
    try {
      return await super.catch(err);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.findError('INVALID_AUTHORIZATION_HEADER')) {
          this.error('Invalid API token');
        }

        if (err.findError('INSUFFICIENT_PERMISSIONS')) {
          this.error(
            'The API token does not have the necessary permission to perform the operation',
          );
        }
      }

      throw err;
    }
  }
}

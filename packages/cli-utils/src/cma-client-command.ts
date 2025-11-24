import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ApiError,
  type Client,
  type ClientConfigOptions,
  LogLevel,
  buildClient,
} from '@datocms/cma-client-node';
import { Flags } from '@oclif/core';
import { fetch as ponyfillFetch } from '@whatwg-node/fetch';
import chalk from 'chalk';
import { DatoProfileConfigCommand } from './dato-profile-config-command';

const fetchFn = typeof fetch === 'undefined' ? ponyfillFetch : fetch;

export const logLevelMap = {
  NONE: LogLevel.NONE,
  BASIC: LogLevel.BASIC,
  BODY: LogLevel.BODY,
  BODY_AND_HEADERS: LogLevel.BODY_AND_HEADERS,
} as const;

export type LogLevelFlagEnum = keyof typeof logLevelMap;
export const logLevelOptions = Object.keys(logLevelMap) as LogLevelFlagEnum[];

export type LogLevelModeEnum = 'stdout' | 'file' | 'directory';
export const logLevelModes = ['stdout', 'file', 'directory'];

export abstract class CmaClientCommand extends DatoProfileConfigCommand {
  static baseFlags = {
    ...DatoProfileConfigCommand.baseFlags,
    'api-token': Flags.string({
      description: 'Specify a custom API key to access a DatoCMS project',
      helpGroup: 'GLOBAL',
    }),
    'log-level': Flags.custom<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging for performed API calls',
      helpGroup: 'GLOBAL',
    })(),
    'log-mode': Flags.custom<LogLevelModeEnum>({
      options: logLevelModes,
      description: 'Where logged output should be written to',
      helpGroup: 'GLOBAL',
    })(),
    'base-url': Flags.string({ hidden: true }),
  };

  protected client!: Client;

  protected async init(): Promise<void> {
    await super.init();

    this.client = await this.buildClient();
  }

  protected async buildBaseClientInitializationOptions(): Promise<
    Partial<ClientConfigOptions> & {
      apiToken: string;
    }
  > {
    const apiTokenEnvName =
      this.profileId === 'default'
        ? 'DATOCMS_API_TOKEN'
        : `DATOCMS_${this.profileId.toUpperCase()}_PROFILE_API_TOKEN`;

    const { flags } = await this.parse(this.ctor as typeof CmaClientCommand);

    const apiToken = flags['api-token'] || process.env[apiTokenEnvName];

    const baseUrl = flags['base-url'] || this.datoProfileConfig?.baseUrl;

    const logLevelCode = flags['log-level'] || this.datoProfileConfig?.logLevel;

    const logMode = flags['log-mode'] || this.datoProfileConfig?.logMode;

    const logLevel =
      flags.json || flags.output || !logLevelCode
        ? LogLevel.NONE
        : logLevelMap[logLevelCode];

    if (!apiToken) {
      this.error('Cannot find an API token to use to call DatoCMS!', {
        suggestions: [
          `The API token to use is determined by looking at:
* The --api-token flag
* The ${apiTokenEnvName} environment variable (we look inside .env.local and .env too)`,
        ],
      });
    }

    return {
      apiToken,
      baseUrl,
      logLevel,
      logFn: (message) => {
        if (logMode === 'directory') {
          // every message starts with '[<API-CALL-SEQUENTIAL-INTEGER>] ...'
          const match = message.match(/^\[([^\]]+)\]/);

          if (!match) {
            return;
          }

          const sequentialInteger = match[1];
          const logDir = './api-calls';
          const logFileName = join(logDir, `${sequentialInteger}.log`);

          // Ensure the directory exists
          if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
          }

          appendFileSync(logFileName, `${message}\n`, {
            encoding: 'utf8',
          });
        } else if (logMode === 'file') {
          appendFileSync('./api-calls.log', `${message}\n`, {
            encoding: 'utf8',
          });
        } else {
          this.log(chalk.gray(message));
        }
      },
    };
  }

  protected async buildClient(
    config: Partial<ClientConfigOptions> = {},
  ): Promise<Client> {
    return buildClient({
      ...(await this.buildBaseClientInitializationOptions()),
      ...config,
      fetchFn,
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

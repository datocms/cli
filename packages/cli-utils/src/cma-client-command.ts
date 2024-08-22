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
import * as chalk from 'chalk';
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
export const logLevelModes: LogLevelModeEnum[] = [
  'stdout',
  'file',
  'directory',
];

export abstract class CmaClientCommand<
  T extends typeof CmaClientCommand.flags,
> extends DatoProfileConfigCommand<T> {
  static flags = {
    ...DatoProfileConfigCommand.flags,
    'api-token': Flags.string({
      description: 'Specify a custom API key to access a DatoCMS project',
    }),
    'log-level': Flags.enum<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging for performed API calls',
    }),
    'log-mode': Flags.enum<LogLevelModeEnum>({
      options: logLevelModes,
      description: 'Where logged output should be written to',
    }),
    'base-url': Flags.string({ hidden: true }),
  };

  protected client!: Client;

  protected async init(): Promise<void> {
    await super.init();
    this.client = this.buildClient();
  }

  protected buildBaseClientInitializationOptions(): Partial<ClientConfigOptions> & {
    apiToken: string;
  } {
    const apiTokenEnvName =
      this.profileId === 'default'
        ? 'DATOCMS_API_TOKEN'
        : `DATOCMS_${this.profileId.toUpperCase()}_PROFILE_API_TOKEN`;

    const apiToken =
      this.parsedFlags['api-token'] || process.env[apiTokenEnvName];

    const baseUrl =
      this.parsedFlags['base-url'] || this.datoProfileConfig?.baseUrl;

    const logLevelCode =
      this.parsedFlags['log-level'] || this.datoProfileConfig?.logLevel;

    const logMode =
      this.parsedFlags['log-mode'] || this.datoProfileConfig?.logMode;

    const logLevel =
      this.parsedFlags.json || this.parsedFlags.output || !logLevelCode
        ? LogLevel.NONE
        : logLevelMap[logLevelCode];

    if (!apiToken) {
      this.error('Cannot find an API token to use to call DatoCMS!', {
        suggestions: [
          `The API token to use is determined by looking at:
* The --api-token flag
* The ${apiTokenEnvName} environment variable (we look inside a local ".env" file too)`,
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

  protected buildClient(config: Partial<ClientConfigOptions> = {}): Client {
    return buildClient({
      ...this.buildBaseClientInitializationOptions(),
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

import {
  ApiError,
  buildClient,
  Client,
  ClientConfigOptions,
  LogLevel,
} from '@datocms/cma-client-node';
import { Flags } from '@oclif/core';
import { DatoProfileConfigCommand } from './dato-profile-config-command';
import * as chalk from 'chalk';

export const logLevelMap = {
  NONE: LogLevel.NONE,
  BASIC: LogLevel.BASIC,
  BODY: LogLevel.BODY,
  BODY_AND_HEADERS: LogLevel.BODY_AND_HEADERS,
} as const;

export type LogLevelFlagEnum = keyof typeof logLevelMap;
export const logLevelOptions = Object.keys(logLevelMap) as LogLevelFlagEnum[];

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
    'base-url': Flags.string({ hidden: true }),
  };

  protected client!: Client;

  protected async init(): Promise<void> {
    await super.init();
    this.client = this.buildClient();
  }

  protected buildBaseClientInitializationOptions(): {
    apiToken: string;
    baseUrl: string | undefined;
    logLevel: LogLevel;
  } {
    const apiTokenEnvName =
      this.profileId === 'default'
        ? `DATOCMS_API_TOKEN`
        : `DATOCMS_${this.profileId.toUpperCase()}_PROFILE_API_TOKEN`;

    const apiToken =
      this.parsedFlags['api-token'] || process.env[apiTokenEnvName];

    const baseUrl =
      this.parsedFlags['base-url'] || this.datoProfileConfig?.baseUrl;

    const logLevelCode =
      this.parsedFlags['log-level'] || this.datoProfileConfig?.logLevel;

    const logLevel =
      this.parsedFlags.json || this.parsedFlags.output || !logLevelCode
        ? LogLevel.NONE
        : logLevelMap[logLevelCode];

    if (!apiToken) {
      this.error(`Cannot find an API token to use to call DatoCMS!`, {
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
    };
  }

  protected buildClient(config: Partial<ClientConfigOptions> = {}): Client {
    return buildClient({
      ...this.buildBaseClientInitializationOptions(),
      logFn: (message) => {
        this.log(chalk.gray(message));
      },
      ...config,
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

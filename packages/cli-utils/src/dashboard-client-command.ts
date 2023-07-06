import {
  ApiError,
  buildClient as buildDashboardClient,
  Client,
  ClientConfigOptions,
  LogLevel,
} from '@datocms/dashboard-client';
import { Flags } from '@oclif/core';
import * as chalk from 'chalk';
import { LogLevelFlagEnum, logLevelMap, logLevelOptions } from '.';
import { DatoProfileConfigCommand } from './dato-profile-config-command';

export abstract class DashboardClientCommand<
  T extends typeof DashboardClientCommand.flags,
> extends DatoProfileConfigCommand<T> {
  static flags = {
    ...DatoProfileConfigCommand.flags,
    email: Flags.string({
      required: true,
      description: 'User email',
    }),
    password: Flags.string({
      required: true,
      description: 'User password',
    }),
    'otp-code': Flags.string({
      description: 'OTP code',
    }),
    'log-level': Flags.enum<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging for performed API calls',
    }),
    'base-url': Flags.string({ hidden: true }),
  };

  protected dashboardClient!: Client;

  protected async init(): Promise<void> {
    await super.init();
    this.dashboardClient = await this.buildClient();
  }

  protected buildBaseClientInitializationOptions(): {
    email: string;
    password: string;
    otpCode?: string | undefined;
    baseUrl: string | undefined;
    logLevel: LogLevel;
  } {
    const email = this.parsedFlags['email'] || process.env['EMAIL'];

    const password = this.parsedFlags['password'] || process.env['PASSWORD'];

    const otpCode = this.parsedFlags['otp-code'];

    const baseUrl =
      this.parsedFlags['base-url'] || this.datoProfileConfig?.baseUrl;

    const logLevelCode =
      this.parsedFlags['log-level'] || this.datoProfileConfig?.logLevel;

    const logLevel =
      this.parsedFlags.json || this.parsedFlags.output || !logLevelCode
        ? LogLevel.NONE
        : logLevelMap[logLevelCode];

    if (!(email && password)) {
      this.error('Please provide your email and password!', {
        suggestions: [
          'Use the --email, --password flags to provide your credentials.',
        ],
      });
    }

    return {
      email,
      password,
      otpCode,
      baseUrl,
      logLevel,
    };
  }

  protected async buildClient(
    config: Partial<ClientConfigOptions> = {},
  ): Promise<Client> {
    const { email, password, otpCode, baseUrl, logLevel } =
      this.buildBaseClientInitializationOptions();

    const loggedOutclient = buildDashboardClient({ apiToken: null });
    const session = await loggedOutclient.session.rawCreate({
      data: {
        type: 'email_credentials',
        attributes: {
          email,
          password,
          otp_code: otpCode,
        },
      },
    });

    return buildDashboardClient({
      apiToken: session.data.id,
      baseUrl,
      logLevel,
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
          this.error('Invalid credentials');
        }
      }

      throw err;
    }
  }
}

import { CliUx, Command } from '@oclif/core';
import { CLIError } from '@oclif/core/lib/errors';
import type { FlagInput, ParserOutput } from '@oclif/core/lib/interfaces';
import { get } from 'lodash';
import { serializeError } from 'serialize-error';

type InferredFlagsType<T> = T extends FlagInput<infer F>
  ? F & {
      json: boolean | undefined;
      output: string | undefined;
    }
  : any;

export abstract class BaseCommand<
  T extends typeof BaseCommand.flags,
> extends Command {
  static flags = {};
  static enableJsonFlag = true;

  protected parsedOutput!: ParserOutput<any, any>;
  protected parsedArgs!: { [name: string]: string };
  protected parsedFlags!: InferredFlagsType<T>;

  protected async init(): Promise<void> {
    await super.init();

    this.parsedOutput = await this.parse(this.ctor);
    this.parsedFlags = this.parsedOutput?.flags ?? {};
    this.parsedArgs = this.parsedOutput?.args ?? {};
  }

  protected toErrorJson(err: any): any {
    return { error: { message: err.message, ...err } };
  }

  protected startSpinner(
    action: string,
    status?: string,
    opts?: {
      stdout?: boolean;
    },
  ): void {
    if (this.jsonEnabled()) {
      return;
    }

    CliUx.ux.action.start(action, status, opts);
  }

  protected stopSpinner(message?: string): void {
    if (this.jsonEnabled()) {
      return;
    }

    CliUx.ux.action.stop(message);
  }

  protected printTable<T extends Record<string, unknown>>(
    data: T[],
    primaryColumns: string[],
    extendedColumns: string[],
  ): void {
    if (this.jsonEnabled()) {
      return;
    }

    CliUx.ux.table(
      data,
      Object.fromEntries(
        [...primaryColumns, ...extendedColumns].map((key) => [
          key,
          {
            get: (e: T) => get(e, key),
            extended: extendedColumns.includes(key),
            header: key,
          },
        ]),
      ),
      {
        ...this.parsedFlags,
        printLine: this.log.bind(this),
      },
    );
  }

  protected catch(
    error: Error & { exitCode?: number | undefined },
  ): Promise<any> {
    if (error instanceof CLIError) {
      const serialized = serializeError(error);

      console.log();
      console.dir(serialized, { depth: null, colors: true });
      console.log();
    }

    throw error;
  }
}

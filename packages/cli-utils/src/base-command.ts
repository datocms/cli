import { Command, ux } from '@oclif/core';
import { serializeError } from 'serialize-error';
import TtyTable = require('tty-table');

export abstract class BaseCommand extends Command {
  static flags = {};
  static baseFlags = {};

  static enableJsonFlag = true;

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

    ux.action.start(action, status, opts);
  }

  protected stopSpinner(message?: string): void {
    if (this.jsonEnabled()) {
      return;
    }

    ux.action.stop(message);
  }

  protected stopSpinnerWithFailure(): void {
    if (this.jsonEnabled()) {
      return;
    }

    ux.action.stop('FAILED!');
  }

  protected printTable<T extends Record<string, unknown>>(
    data: T[],
    columns: string[],
  ): void {
    if (this.jsonEnabled()) {
      return;
    }

    const table = TtyTable(columns, data);

    this.log.bind(table.render());
  }

  protected catch(
    error: Error & { exitCode?: number | undefined },
  ): Promise<any> {
    const serialized = serializeError(error);

    console.log();
    console.dir(serialized, { depth: null, colors: true });
    console.log();

    throw error;
  }
}

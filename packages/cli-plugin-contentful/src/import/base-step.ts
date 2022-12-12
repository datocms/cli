import { CmaClient } from '@datocms/cli-utils';
import { Scheduler } from 'async-scheduler';
import { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import { Environment } from 'contentful-management';
import { Context, StepOptions } from '../commands/contentful/import';

export default class BaseStep {
  protected options: StepOptions;

  constructor(options: StepOptions) {
    this.options = options;
  }

  protected get cfEnvironmentApi(): Environment {
    return this.options.cfEnvironmentApi;
  }

  protected get client(): CmaClient.Client {
    return this.options.client;
  }

  protected get autoconfirm(): boolean {
    return this.options.autoconfirm;
  }

  protected get ignoreErrors(): boolean {
    return this.options.ignoreErrors;
  }

  protected get scheduler(): Scheduler {
    return this.options.scheduler;
  }

  protected get listrTask(): ListrTaskWrapper<Context, ListrRendererFactory> {
    return this.options.task;
  }

  protected get ctx(): Context {
    return this.options.ctx;
  }

  protected async runConcurrentlyOver<T>(
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
    title: string,
    items: T[],
    buildIdentifier: (object: T) => string,
    handler: (
      object: T,
      notifyProgress: (message: string) => void,
    ) => Promise<void>,
  ): Promise<void> {
    const promises: Array<Promise<void>> = [];

    let finished = 0;
    let failed = 0;

    const runningInfo: Record<string, string> = {};
    const refreshOutput = () => {
      task.output = Object.entries(runningInfo)
        .map(([id, message]) => `* ${id}: ${message}`)
        .join('\n');
    };

    task.title = `${title} (0 of ${items.length})`;

    for (const item of items) {
      promises.push(
        this.scheduler.enqueue(async () => {
          const identifier = buildIdentifier(item);

          try {
            const notifier = (message: string) => {
              runningInfo[identifier] = message;
              refreshOutput();
            };

            notifier('started');
            await handler(item, notifier);
            notifier('done');
          } catch (e) {
            failed += 1;
            if (!this.ignoreErrors) {
              throw e;
            }
          } finally {
            finished += 1;
            runningInfo[identifier] = undefined;
            task.title = `${title} (${finished} of ${items.length}${
              failed > 0 ? `, ${failed} failed` : ''
            })`;
          }
        }),
      );
    }

    await Promise.all(promises);
  }
}

import type { CmaClient } from '@datocms/cli-utils';
import type { Scheduler } from 'async-scheduler';
import type { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import type WPAPI from 'wpapi';
import type { WPRequest } from 'wpapi';
import type { Context, StepOptions } from '../commands/wordpress/import';

export default class BaseStep {
  protected options: StepOptions;

  constructor(options: StepOptions) {
    this.options = options;
  }

  protected get wpClient(): WPAPI {
    return this.options.wpClient;
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

    const runningInfo: Record<string, string | undefined> = {};
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

  async fetchAllWpPages<T>(
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
    title: string,
    requestPromise: WPRequest,
    page = 1,
    retryCount = 1,
  ): Promise<T[]> {
    let response: any;

    try {
      response = await this.scheduler.enqueue(async () => {
        return await requestPromise;
      });
    } catch (e) {
      if (retryCount > 10) {
        throw e;
      }

      return [
        ...(response || []),
        ...(await this.fetchAllWpPages(
          task,
          title,
          requestPromise,
          page,
          retryCount + 1,
        )),
      ];
    }

    if (!response._paging || response._paging.totalPages <= page) {
      return response;
    }

    task.output = `${title} (page ${page} of ${response._paging.totalPages})`;

    const nextPage = response._paging.next.page(page + 1);

    return [
      ...response,
      ...(await this.fetchAllWpPages(task, title, nextPage, page + 1)),
    ];
  }
}

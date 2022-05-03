import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';
import { buildWpClient } from '../../utils/build-wp-client';
import * as WPAPI from 'wpapi';
import {
  Listr,
  ListrTaskWrapper,
  ListrRendererFactory,
  ListrDefaultRenderer,
} from 'listr2';
import DestroySchema from '../../import/destroy-dato-schema';
import ImportWpAssets from '../../import/import-wp-assets';
import ImportCategories from '../../import/import-wp-categories';
import ImportTags from '../../import/import-wp-tags';
import ImportAuthors from '../../import/import-wp-authors';
import ImportPages from '../../import/import-wp-pages';
import ImportArticles from '../../import/import-wp-articles';
import { Scheduler } from 'async-scheduler';

export type StepOptions = {
  client: CmaClient.Client;
  wpClient: WPAPI;
  autoconfirm: boolean;
  ignoreErrors: boolean;
  scheduler: Scheduler;
  ctx: Context;
  task: ListrTaskWrapper<Context, ListrRendererFactory>;
};

export type Context = {
  datoItemTypes: {
    tag?: CmaClient.SimpleSchemaTypes.ItemType;
    article?: CmaClient.SimpleSchemaTypes.ItemType;
    page?: CmaClient.SimpleSchemaTypes.ItemType;
    category?: CmaClient.SimpleSchemaTypes.ItemType;
    author?: CmaClient.SimpleSchemaTypes.ItemType;
  };
  wpMediaItems?: Array<Record<string, any>>;
  wpTags?: Array<any>;
  wpCategories?: Array<any>;
  wpAuthors?: Array<any>;
  wpPages?: Array<any>;
  wpArticles?: Array<any>;
  tagsMapping?: Record<string, string>;
  categoriesMapping?: Record<string, string>;
  authorsMapping?: Record<string, string>;
  wpAssetUrlToDatoUrl?: Record<string, string>;
  wpAssetIdToDatoId?: Record<string, string>;
};
export default class ImportCommand extends CmaClientCommand<
  typeof ImportCommand.flags
> {
  static description = 'Imports a WordPress site into a DatoCMS project';

  static flags = {
    ...CmaClientCommand.flags,
    'wp-json-api-url': oclif.Flags.string({
      description:
        'The endpoint for your WordPress install (ex. https://www.wordpress-website.com/wp-json)',
      exclusive: ['wp-url'],
    }),
    'wp-url': oclif.Flags.string({
      description:
        'A URL within a WordPress REST API-enabled site (ex. https://www.wordpress-website.com)',
      exclusive: ['wp-json-url'],
    }),
    'wp-username': oclif.Flags.string({
      description: 'WordPress username',
      required: true,
    }),
    'wp-password': oclif.Flags.string({
      description: 'WordPress password',
      required: true,
    }),
    autoconfirm: oclif.Flags.boolean({
      description:
        'Automatically enters the affirmative response to all confirmation prompts, enabling the command to execute without waiting for user confirmation. Forces the destroy of existing "wp_*" models.',
    }),
    'ignore-errors': oclif.Flags.boolean({
      description: 'Try to ignore errors encountered during import',
    }),
    concurrency: oclif.Flags.integer({
      description: 'Maximum number of operations to be run concurrently',
      default: 15,
    }),
  };

  protected wpClient!: WPAPI;
  protected datoSchema!: Record<string, string>;

  async run(): Promise<void> {
    this.wpClient = await buildWpClient({
      username: this.parsedFlags['wp-username'],
      password: this.parsedFlags['wp-password'],
      apiUrl: this.parsedFlags['wp-json-api-url'],
      discoverUrl: this.parsedFlags['wp-url'],
    });

    const options: Omit<StepOptions, 'ctx' | 'task'> = {
      autoconfirm: this.parsedFlags.autoconfirm,
      ignoreErrors: this.parsedFlags['ignore-errors'],
      client: this.client,
      wpClient: this.wpClient,
      scheduler: new Scheduler(this.parsedFlags.concurrency),
    };

    const tasks = new Listr<Context>(
      [
        {
          title: 'Destroy existing WordPress schema from DatoCMS project',
          task: async (ctx, task) => {
            return new DestroySchema({ ...options, ctx, task }).task();
          },
        },
        {
          title: 'Import WordPress metadata',
          task: async () => {
            return new Listr<Context>(
              [
                {
                  title: 'Import WordPress categories',
                  task: async (ctx, task) => {
                    return new ImportCategories({
                      ...options,
                      ctx,
                      task,
                    }).task();
                  },
                },
                {
                  title: 'Import WordPress tags',
                  task: async (ctx, task) => {
                    return new ImportTags({
                      ...options,
                      ctx,
                      task,
                    }).task();
                  },
                },
                {
                  title: 'Import WordPress authors',
                  task: async (ctx, task) => {
                    return new ImportAuthors({
                      ...options,
                      ctx,
                      task,
                    }).task();
                  },
                },
                {
                  title: 'Import WordPress assets',
                  task: async (ctx, task) => {
                    return new ImportWpAssets({
                      ...options,
                      ctx,
                      task,
                    }).task();
                  },
                },
              ],
              { concurrent: true },
            );
          },
        },
        {
          title: 'Import WordPress pages and articles',
          task: async () => {
            return new Listr<Context>(
              [
                {
                  title: 'Import WordPress pages',
                  task: async (ctx, task) => {
                    return new ImportPages({
                      ...options,
                      ctx,
                      task,
                    }).task();
                  },
                },
                {
                  title: 'Import WordPress articles',
                  task: async (ctx, task) => {
                    return new ImportArticles({
                      ...options,
                      ctx,
                      task,
                    }).task();
                  },
                },
              ],
              { concurrent: true },
            );
          },
        },
      ],
      {
        rendererOptions: {
          collapse: false,
          showTimer: true,
          clearOutput: false,
          collapseErrors: false,
        },
      },
    );

    await tasks.run({ datoItemTypes: {} });
  }
}

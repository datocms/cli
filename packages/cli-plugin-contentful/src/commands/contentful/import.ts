import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';
import { cfEnvironmentApi } from '../../utils/build-contentful-client';
import DestroyDatoSchema from '../../import/destroy-dato-schema';
import ImportModels from '../../import/import-models';
import ImportFields from '../../import/import-fields';
import ImportAssets from '../../import/import-assets';
import ImportRecords from '../../import/import-records';
import {
  Asset,
  ContentFields,
  ContentType,
  Entry,
  Environment,
} from 'contentful-management';
import { Scheduler } from 'async-scheduler';
import { Listr, ListrTaskWrapper, ListrRendererFactory } from 'listr2';
import isArrayWithAtLeastOneElement from '../../utils/is-array-with-at-least-one-element';
import AddValidations from '../../import/add-validations';
import { getAll } from '../../utils/getAll';

export type StepOptions = {
  client: CmaClient.Client;
  cfEnvironmentApi: Environment;
  autoconfirm: boolean;
  ignoreErrors: boolean;
  skipContent: boolean;
  scheduler: Scheduler;
  ctx: Context;
  task: ListrTaskWrapper<Context, ListrRendererFactory>;
  importOnly: string[] | undefined;
};

export type Context = {
  itemTypesToDestroy: CmaClient.SimpleSchemaTypes.ItemType[];
  datoItemTypes: CmaClient.SimpleSchemaTypes.ItemType[];
  contentTypes: ContentType[];
  defaultLocale: string;
  assetBlockId: string;
  locales: [string, ...string[]];
  contentTypeIdToDatoItemType: {
    [k: ContentType['sys']['id']]: CmaClient.SimpleSchemaTypes.ItemType;
  };
  contentTypeIdToDatoFields: {
    [key: ContentType['sys']['id']]: {
      [key: ContentFields['id']]: CmaClient.SimpleSchemaTypes.Field;
    };
  };
  contentfulFields: ContentFields[];
  entriesWithLinkField: Entry[];
  entryIdToDatoItemId: {
    [k: Entry['sys']['id']]: CmaClient.SimpleSchemaTypes.ItemIdentity;
  };
  uploadIdToDatoUploadInfo: {
    [key: Asset['sys']['id']]: {
      id: CmaClient.SimpleSchemaTypes.UploadIdentity;
      url: string;
    };
  };
  uploadUrlToDatoUploadUrl: Record<string, string>;
};
export default class ImportCommand extends CmaClientCommand<
  typeof ImportCommand.flags
> {
  static description = 'Import a Contentful project into a DatoCMS project';

  static flags = {
    ...CmaClientCommand.flags,
    'contentful-token': oclif.Flags.string({
      description: 'Your Contentful project read-only API token',
    }),
    'contentful-space-id': oclif.Flags.string({
      description: 'Your Contentful project space ID',
    }),
    'contentful-environment': oclif.Flags.string({
      description: 'The environment you want to work with',
    }),
    autoconfirm: oclif.Flags.boolean({
      description:
        'Automatically enter an affirmative response to all confirmation prompts, enabling the command to execute without waiting for user confirmation, like forcing the destroy of existing Contentful schema models.',
    }),
    'ignore-errors': oclif.Flags.boolean({
      description: 'Ignore errors encountered during import',
    }),
    'skip-content': oclif.Flags.boolean({
      description:
        'Exclusively import the schema (models) and ignore records and assets',
    }),
    'only-content-type': oclif.Flags.string({
      description:
        'Exclusively import the specified content types. Specify the content types you want to import with comma separated Contentful IDs - Example: blogPost,landingPage,author',
    }),
    concurrency: oclif.Flags.integer({
      description:
        'Specify the maximum number of operations to be run concurrently',
      default: 15,
    }),
  };

  protected cfEnvironmentApi!: Environment;
  protected datoSchema!: Record<string, string>;

  async run(): Promise<void> {
    this.cfEnvironmentApi = await cfEnvironmentApi({
      contentfulToken: this.parsedFlags['contentful-token'],
      contentfulSpaceId: this.parsedFlags['contentful-space-id'],
      contentfulEnvironment: this.parsedFlags['contentful-environment'],
    });

    const options: Omit<StepOptions, 'ctx' | 'task'> = {
      autoconfirm: this.parsedFlags.autoconfirm,
      ignoreErrors: this.parsedFlags['ignore-errors'],
      client: this.client,
      cfEnvironmentApi: this.cfEnvironmentApi,
      scheduler: new Scheduler(this.parsedFlags.concurrency),
      importOnly: this.parsedFlags['only-content-type']?.split(','),
      skipContent: this.parsedFlags['skip-content'],
    };

    const tasks = new Listr<Context>(
      [
        {
          title: 'Destroy existing Contentful schema from DatoCMS project',
          task: async (ctx, task) => {
            return new DestroyDatoSchema({ ...options, ctx, task }).task(
              ctx,
              task,
            );
          },
        },
        {
          title: 'Copy Contentful schema',
          task: async () => {
            return new Listr<Context>([
              {
                title: 'Set locales',
                task: async (ctx, _task) => {
                  const rawLocales = await getAll(
                    this.cfEnvironmentApi.getLocales.bind(
                      this.cfEnvironmentApi,
                    ),
                  );

                  if (!isArrayWithAtLeastOneElement(rawLocales)) {
                    throw new Error('This should not happen');
                  }

                  const defaultLocale = rawLocales.find(
                    (locale) => locale.default,
                  );

                  if (!defaultLocale) {
                    throw new Error('This should not happen');
                  }

                  ctx.defaultLocale = defaultLocale.code;

                  ctx.locales = rawLocales.map((locale) => locale.code) as [
                    string,
                    ...string[],
                  ];

                  await this.client.site.update({
                    locales: ctx.locales,
                  });
                },
              },
              {
                title: 'Import models from Contentful',
                task: async (ctx, task) => {
                  return new ImportModels({
                    ...options,
                    ctx,
                    task,
                  }).task(ctx, task);
                },
              },
              {
                title: 'Import fields from Contentful',
                task: async (ctx, task) => {
                  return new ImportFields({
                    ...options,
                    ctx,
                    task,
                  }).task(ctx, task);
                },
              },
            ]);
          },
        },
        {
          title: 'Import content from Contentful',
          task: async () => {
            return new Listr<Context>([
              {
                title: 'Import assets from Contentful',
                task: async (ctx, task) => {
                  return new ImportAssets({
                    ...options,
                    ctx,
                    task,
                  }).task(ctx, task);
                },
              },
              {
                title: 'Import records from Contentful',
                task: async (ctx, task) => {
                  return new ImportRecords({
                    ...options,
                    ctx,
                    task,
                  }).task();
                },
              },
            ]);
          },
          enabled: !this.parsedFlags['skip-content'],
        },
        {
          title: 'Add validations to fields',
          task: async (ctx, task) => {
            return new AddValidations({
              ...options,
              ctx,
              task,
            }).task(ctx, task);
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

    await tasks.run();
  }
}

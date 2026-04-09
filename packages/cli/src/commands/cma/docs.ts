import { BaseCommand, oclif } from '@datocms/cli-utils';
import {
  type RawResourcesSchema,
  describeResource,
  describeResourceAction,
  fetchHyperschema,
  listResources,
  parseResourcesSchema,
} from '@datocms/rest-api-reference';

export default class Docs extends BaseCommand {
  static description =
    'Browse the DatoCMS Content Management API reference documentation';

  static examples = [
    {
      description: 'List all available resources',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Describe a specific resource and its actions',
      command: '<%= config.bin %> <%= command.id %> items',
    },
    {
      description: 'Describe a specific action with examples',
      command: '<%= config.bin %> <%= command.id %> items create',
    },
    {
      description: 'Expand a collapsed details section',
      command:
        '<%= config.bin %> <%= command.id %> items create --expand "Example: Basic example"',
    },
  ];

  static args = {
    resource: oclif.Args.string({
      description: 'The resource to describe (e.g., items, uploads)',
      required: false,
    }),
    action: oclif.Args.string({
      description: 'The action to describe (e.g., create, instances)',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    expand: oclif.Flags.string({
      description:
        'Expand a collapsed <details> section by its summary text (can be repeated)',
      multiple: true,
      required: false,
    }),
  };

  static enableJsonFlag = false;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Docs);

    this.startSpinner('Fetching API reference');

    const [hyperschema, resourcesSchema] = await Promise.all([
      fetchHyperschema('cma'),
      this.loadResourcesSchema(),
    ]);

    this.stopSpinner();

    if (!args.resource) {
      this.log(listResources(hyperschema, resourcesSchema));
      return;
    }

    if (!args.action) {
      const result = describeResource(
        hyperschema,
        resourcesSchema,
        args.resource,
        flags.expand,
      );

      if (!result) {
        this.error(`Resource "${args.resource}" not found.`, {
          suggestions: [
            'Run `datocms cma:docs` to see all available resources.',
          ],
        });
      }

      this.log(result);
      return;
    }

    const result = describeResourceAction(
      hyperschema,
      resourcesSchema,
      args.resource,
      args.action,
      flags.expand,
    );

    if (!result) {
      this.error(
        `Action "${args.action}" not found for resource "${args.resource}".`,
        {
          suggestions: [
            `Run \`datocms cma:docs ${args.resource}\` to see available actions.`,
          ],
        },
      );
    }

    this.log(result);
  }

  private async loadResourcesSchema() {
    const raw = this.loadRawResources();
    return parseResourcesSchema(raw);
  }

  private loadRawResources(): RawResourcesSchema {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@datocms/cma-client/resources.json');
  }
}

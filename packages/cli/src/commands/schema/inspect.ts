import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';
import {
  type FieldDetailsOption,
  type FieldsDetails,
  type SchemaFilterType,
  collectSchemaInfo,
} from '../../utils/schema-info';

export default class Command extends CmaClientCommand {
  static description =
    'Inspect DatoCMS models and modular blocks — emits JSON with models, fields, fieldsets, nested blocks, and relationships.\n' +
    '\n' +
    'Without arguments, lists every model and block in the project. Pass a\n' +
    'filter to narrow down by API key (e.g. "blog_post"), ID, or display\n' +
    'name; if no exact match is found a fuzzy search is used.\n' +
    '\n' +
    'By default, fields are returned without validators, appearance, or\n' +
    'default values. Use `--include-validators`, `--include-appearance`,\n' +
    '`--include-default-values`, or `--fields-details=complete` to opt in.\n' +
    '\n' +
    'Output is TOON on stdout (compact, agent-friendly). Pass `--json` for\n' +
    'JSON output that composes with `| jq` and similar.';

  static examples = [
    {
      description: 'List every model and block in the project',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Inspect a single model by API key',
      command: '<%= config.bin %> <%= command.id %> blog_post',
    },
    {
      description: 'Only modular blocks, with fieldsets',
      command:
        '<%= config.bin %> <%= command.id %> --type=blocks_only --include-fieldsets',
    },
    {
      description: 'Include validators and appearance for the given model',
      command:
        '<%= config.bin %> <%= command.id %> blog_post --include-validators --include-appearance',
    },
    {
      description: 'Full detail (verbose), piped through jq',
      command:
        "<%= config.bin %> <%= command.id %> blog_post --fields-details=complete --json | jq '.[].fields[].api_key'",
    },
    {
      description:
        'Inspect a block plus every model that embeds it (directly or indirectly)',
      command:
        '<%= config.bin %> <%= command.id %> my_block --type=blocks_only --include-embedding-models',
    },
  ];

  static args = {
    filter: oclif.Args.string({
      description:
        'Filter by API key, ID, or display name. Falls back to fuzzy search if no exact match is found. If omitted, all models/blocks are returned.',
      required: false,
    }),
  };

  static flags = {
    ...CmaClientCommand.flags,
    environment: oclif.Flags.string({
      char: 'e',
      description: 'Environment to inspect',
      required: false,
    }),
    type: oclif.Flags.custom<SchemaFilterType>({
      description: 'Restrict to models, blocks, or both',
      options: ['all', 'models_only', 'blocks_only'],
      default: 'all',
      required: false,
    })(),
    'fields-details': oclif.Flags.custom<'basic' | 'complete'>({
      description:
        'Level of detail returned for each field. `basic` drops validators, appearance, and default values; `complete` includes everything (very verbose). For selective inclusion use the `--include-*` flags instead.',
      options: ['basic', 'complete'],
      default: 'basic',
      required: false,
    })(),
    'include-validators': oclif.Flags.boolean({
      description: 'Include field validators',
      required: false,
      default: false,
    }),
    'include-appearance': oclif.Flags.boolean({
      description: 'Include field appearance configuration',
      required: false,
      default: false,
    }),
    'include-default-values': oclif.Flags.boolean({
      description: 'Include field default values',
      required: false,
      default: false,
    }),
    'include-fieldsets': oclif.Flags.boolean({
      description: 'Include UI fieldset organization',
      required: false,
      default: false,
    }),
    'include-nested-blocks': oclif.Flags.boolean({
      description:
        'Recursively include every block nested in the selected item types',
      required: false,
      default: false,
    }),
    'include-referenced-models': oclif.Flags.boolean({
      description:
        'Include models referenced by link, links, or structured_text fields',
      required: false,
      default: false,
    }),
    'include-embedding-models': oclif.Flags.boolean({
      description:
        'For blocks only: include every model that embeds the selected blocks (direct or transitive)',
      required: false,
      default: false,
    }),
  };

  async run(): Promise<unknown> {
    const { args, flags } = await this.parse(Command);

    const client = await this.buildClient({ environment: flags.environment });
    const repo = new CmaClient.SchemaRepository(client);

    const fieldsDetails = this.resolveFieldsDetails(flags);

    const results = await collectSchemaInfo(repo, {
      filterByName: args.filter,
      filterByType: flags.type,
      fieldsDetails,
      includeFieldsets: flags['include-fieldsets'],
      includeNestedBlocks: flags['include-nested-blocks'],
      includeReferencedModels: flags['include-referenced-models'],
      includeEmbeddingModels: flags['include-embedding-models'],
    });

    if (args.filter && results.length === 0) {
      this.error(`No model or block matched "${args.filter}"`, {
        suggestions: [
          'Run `datocms schema:inspect` without arguments to see everything',
          'Check the API key, ID, or display name of the model/block',
        ],
      });
    }

    if (this.jsonEnabled()) {
      return results;
    }

    const { encode } = await import('@toon-format/toon');
    this.log(encode(results));
    return undefined;
  }

  private resolveFieldsDetails(flags: {
    'fields-details': 'basic' | 'complete' | undefined;
    'include-validators': boolean;
    'include-appearance': boolean;
    'include-default-values': boolean;
  }): FieldsDetails {
    const selective: FieldDetailsOption[] = [];
    if (flags['include-validators']) selective.push('validators');
    if (flags['include-appearance']) selective.push('appearance');
    if (flags['include-default-values']) selective.push('default_values');

    if (selective.length > 0) return selective;

    return flags['fields-details'] ?? 'basic';
  }
}

import { BaseCommand, oclif } from '@datocms/cli-utils';
import {
  type CmaClientProgram,
  type MethodSignatureInfo,
  extractMethodSignature,
  extractResourcesEndpointMethods,
  extractTypeDependencies,
  getCmaClientProgram,
} from '@datocms/cma-client-analysis';
import {
  type RawResourcesSchema,
  type ResourcesEndpoint,
  describeResource,
  describeResourceAction,
  fetchHyperschema,
  findResourcesEndpointByRel,
  findResourcesEntityByNamespace,
  listResources,
  parseResourcesSchema,
} from '@datocms/rest-api-reference';

type SymbolMap = MethodSignatureInfo['referencedTypeSymbols'];

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
    {
      description: 'Inline definitions for every reachable referenced type',
      command:
        '<%= config.bin %> <%= command.id %> items create --expand-types "*"',
    },
    {
      description: 'Inline only specific referenced types',
      command:
        '<%= config.bin %> <%= command.id %> items create --expand-types ItemCreateSchema',
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
    'expand-types': oclif.Flags.string({
      description:
        'Inline TypeScript definitions for types referenced by the action. Pass `*` to expand every reachable type, or specific type names (repeatable) to expand just those',
      multiple: true,
      required: false,
    }),
    'types-depth': oclif.Flags.integer({
      description:
        'Maximum depth when walking referenced types at default expansion (default: 2). Useful only when --expand-types is omitted but you still want types output — set the flag to surface a deeper "Not expanded" list',
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

    const endpoint = this.findEndpoint(
      resourcesSchema,
      args.resource,
      args.action,
    );

    const sections: string[] = [result];
    if (endpoint) {
      // Build the TS program once: getCmaClientProgram() does not cache, and
      // both renderers below need the same checker/clientClass.
      const cmaProgram = getCmaClientProgram();

      const methodsSection = renderMethodsSection(cmaProgram, endpoint);
      if (methodsSection) sections.push(methodsSection);

      const typesSection = renderTypesSection(cmaProgram, endpoint, {
        expandTypes: flags['expand-types'],
        maxDepth: flags['types-depth'],
      });
      if (typesSection) sections.push(typesSection);
    }

    this.log(sections.join('\n'));
  }

  private findEndpoint(
    resourcesSchema: ReturnType<typeof parseResourcesSchema>,
    resource: string,
    action: string,
  ): ResourcesEndpoint | undefined {
    const entity = findResourcesEntityByNamespace(resourcesSchema, resource);
    return entity ? findResourcesEndpointByRel(entity, action) : undefined;
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

function renderMethodsSection(
  cmaProgram: CmaClientProgram,
  endpoint: ResourcesEndpoint,
): string {
  const methods = extractResourcesEndpointMethods(
    cmaProgram.checker,
    cmaProgram.clientClass,
    endpoint,
  );
  if (methods.length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    '## Available client methods',
    '',
    '```typescript',
  ];
  for (const method of methods) {
    lines.push(`// client.${endpoint.namespace}.${method.name}`);
    lines.push(method.functionDefinition);
    if (method.referencedTypes.size > 0) {
      lines.push(
        `// References: ${Array.from(method.referencedTypes).join(', ')}`,
      );
    }
    lines.push('');
  }
  lines.push('```');
  return lines.join('\n');
}

function renderTypesSection(
  cmaProgram: CmaClientProgram,
  endpoint: ResourcesEndpoint,
  options: { expandTypes?: string[]; maxDepth?: number },
): string {
  const wantsExpansion =
    options.expandTypes !== undefined || options.maxDepth !== undefined;
  if (!wantsExpansion) return '';

  const { program, checker, clientClass } = cmaProgram;

  const aggregatedSymbols: SymbolMap = new Map();
  const methods = extractResourcesEndpointMethods(
    checker,
    clientClass,
    endpoint,
  );
  for (const method of methods) {
    const signature = extractMethodSignature(
      checker,
      clientClass,
      endpoint.namespace,
      method.name,
    );
    if (!signature) continue;
    for (const [name, symbol] of signature.referencedTypeSymbols) {
      if (!aggregatedSymbols.has(name)) aggregatedSymbols.set(name, symbol);
    }
  }

  if (aggregatedSymbols.size === 0) return '';

  const { expandedTypes, notExpandedTypes } = extractTypeDependencies(
    checker,
    program,
    Array.from(aggregatedSymbols.keys()),
    aggregatedSymbols,
    {
      maxDepth: options.maxDepth ?? 2,
      expandTypes: options.expandTypes,
    },
  );

  const parts: string[] = ['', '## Referenced type definitions'];
  if (expandedTypes.trim()) {
    parts.push('', '```typescript', expandedTypes.trim(), '```');
  }
  if (notExpandedTypes.length > 0) {
    parts.push(
      '',
      `_Not expanded (pass \`--expand-types <name>\` to drill in):_ ${notExpandedTypes.join(
        ', ',
      )}`,
    );
  }
  return parts.join('\n');
}

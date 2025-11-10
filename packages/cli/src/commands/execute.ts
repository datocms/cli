import * as path from 'node:path';
import { CmaClient, CmaClientCommand, oclif } from '@datocms/cli-utils';

type Resource = {
  jsonApiType: string;
  namespace: string;
  endpoints: Endpoint[];
};

type Endpoint = {
  name?: string; // Simple method name (only present if simpleMethodAvailable)
  rawName: string; // Raw method name (always present)
  method: string;
  comment: string;
  urlTemplate: string;
  urlPlaceholders?: UrlPlaceholder[];
  requestBodyType?: string;
  optionalRequestBody?: boolean;
  docUrl?: string;
};

type UrlPlaceholder = {
  variableName: string;
  isEntityId: boolean;
};

export default class Execute extends CmaClientCommand {
  static description = 'Execute any DatoCMS API method directly from the CLI';

  static examples = [
    {
      description: 'List all roles',
      command: '<%= config.bin %> <%= command.id %> roles list',
    },
    {
      description: 'Find a specific role',
      command: '<%= config.bin %> <%= command.id %> roles find 123',
    },
    {
      description: 'Create a new role',
      command:
        '<%= config.bin %> <%= command.id %> roles create --data \'{"name": "Editor", "can_edit_site": true}\'',
    },
    {
      description: 'Update a role',
      command:
        '<%= config.bin %> <%= command.id %> roles update 123 --data \'{"name": "Updated Name"}\'',
    },
    {
      description: 'Delete a role',
      command: '<%= config.bin %> <%= command.id %> roles destroy 123',
    },
    {
      description: 'List items with query parameters',
      command:
        '<%= config.bin %> <%= command.id %> items list --params \'{"filter[type]": "blog_post"}\'',
    },
  ];

  static args = {
    resource: oclif.Args.string({
      description: 'The resource to call (e.g., roles, items, itemTypes, etc.)',
      required: true,
    }),
    method: oclif.Args.string({
      description: 'The method to execute (e.g., list, find, create, etc.)',
      required: true,
    }),
  };

  static flags = {
    data: oclif.Flags.string({
      description:
        'JSON string containing the request body data (for create/update operations)',
      required: false,
    }),
    params: oclif.Flags.string({
      description: 'JSON string containing query parameters',
      required: false,
    }),
    ...Object.fromEntries(
      // We'll dynamically add flags for URL placeholders during parsing
      [],
    ),
  };

  // Enable strict mode to false to allow dynamic flags
  static strict = false;

  // Enable varargs to capture all remaining arguments
  static enableJsonFlag = true;

  async run(): Promise<unknown> {
    const { args, flags, argv } = await this.parse(Execute);
    const positionalArgs = argv.slice(2) as string[]; // Skip resource and method

    const resources = this.loadResources();
    const resource = this.findResource(resources, args.resource);
    const { endpoint, methodName } = this.findEndpoint(resource, args.method);

    this.log(
      `Executing: ${resource.jsonApiType}.${methodName}() - ${endpoint.comment}`,
    );

    const urlPlaceholders = this.parseUrlPlaceholders(
      endpoint,
      positionalArgs,
      args,
    );
    const bodyData = this.parseRequestBody(endpoint, flags.data, args);
    const queryParams = this.parseQueryParams(flags.params);

    const result = await this.executeApiCall(
      resource,
      endpoint,
      methodName,
      urlPlaceholders,
      bodyData,
      queryParams,
    );

    this.log('\nResult:');
    this.log(JSON.stringify(result, null, 2));

    return result;
  }

  private loadResources(): Resource[] {
    // Try direct path first, then via cli-utils (for monorepo)
    const pathGetters = [
      () => this.getResourcesPath('@datocms/cma-client/package.json'),
      () => this.getResourcesPathViaCliUtils(),
    ];

    for (const getPath of pathGetters) {
      try {
        const resourcesPath = getPath();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(resourcesPath);
      } catch {
        // Try next path
      }
    }

    this.error(
      'Could not load resources.json from @datocms/cma-client package',
      {
        suggestions: [
          'This might be an installation issue. Try running `npm install` again.',
        ],
      },
    );
  }

  private getResourcesPath(packagePath: string): string {
    const pkgPath = require.resolve(packagePath);
    return path.join(path.dirname(pkgPath), 'resources.json');
  }

  private getResourcesPathViaCliUtils(): string {
    const cliUtilsPath = require.resolve('@datocms/cli-utils/package.json');
    return path.join(
      path.dirname(cliUtilsPath),
      'node_modules',
      '@datocms',
      'cma-client',
      'resources.json',
    );
  }

  private findResource(resources: Resource[], userInput: string): Resource {
    const resource = resources.find((r) =>
      this.matchesResourceName(r, userInput),
    );

    if (!resource) {
      this.error(`Resource "${userInput}" not found.`, {
        suggestions: this.getResourceSuggestions(resources, userInput),
      });
    }

    return resource;
  }

  private findEndpoint(
    resource: Resource,
    methodName: string,
  ): { endpoint: Endpoint; methodName: string } {
    const normalizedInput = methodName.toLowerCase();

    // Try to match against both name (simple) and rawName (raw)
    const endpoint = resource.endpoints.find((e) =>
      this.matchesMethodName(e, normalizedInput),
    );

    if (!endpoint) {
      this.error(
        `Method "${methodName}" not found for resource "${resource.jsonApiType}".`,
        {
          suggestions: this.getMethodSuggestions(resource, methodName),
        },
      );
    }

    // Determine which method name matched (simple or raw)
    const matchedMethodName = this.getMatchedMethodName(
      endpoint,
      normalizedInput,
    );

    return { endpoint, methodName: matchedMethodName };
  }

  private matchesMethodName(
    endpoint: Endpoint,
    normalizedInput: string,
  ): boolean {
    return (
      endpoint.name?.toLowerCase() === normalizedInput ||
      endpoint.rawName.toLowerCase() === normalizedInput
    );
  }

  private getMatchedMethodName(
    endpoint: Endpoint,
    normalizedInput: string,
  ): string {
    return endpoint.name?.toLowerCase() === normalizedInput
      ? endpoint.name
      : endpoint.rawName;
  }

  private parseUrlPlaceholders(
    endpoint: Endpoint,
    positionalArgs: string[],
    args: { resource: string; method: string },
  ): Record<string, string> {
    const urlPlaceholders: Record<string, string> = {};

    if (!endpoint.urlPlaceholders || endpoint.urlPlaceholders.length === 0) {
      return urlPlaceholders;
    }

    if (positionalArgs.length < endpoint.urlPlaceholders.length) {
      const placeholderNames = endpoint.urlPlaceholders
        .map((p) => `<${p.variableName}>`)
        .join(' ');

      const parameterList = endpoint.urlPlaceholders
        .map((p) => p.variableName)
        .join(', ');

      this.error(`Missing required parameters for ${args.method} method`, {
        suggestions: [
          `This method requires ${endpoint.urlPlaceholders.length} parameter(s): ${parameterList}`,
          `Usage: ${this.config.bin} ${this.id} ${args.resource} ${args.method} ${placeholderNames}`,
        ],
      });
    }

    // Map positional arguments to URL placeholders
    for (let i = 0; i < endpoint.urlPlaceholders.length; i++) {
      const placeholder = endpoint.urlPlaceholders[i];
      const arg = positionalArgs[i];
      if (placeholder && typeof arg === 'string') {
        urlPlaceholders[placeholder.variableName] = arg;
      }
    }

    return urlPlaceholders;
  }

  private parseRequestBody(
    endpoint: Endpoint,
    dataFlag: string | undefined,
    args: { resource: string; method: string },
  ): unknown {
    const bodyData = dataFlag
      ? this.parseJsonFlag(dataFlag, '--data')
      : undefined;

    this.validateRequestBody(endpoint, dataFlag, args);

    return bodyData;
  }

  private parseJsonFlag(jsonString: string, flagName: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch {
      this.error(`Invalid JSON in ${flagName} flag`, {
        suggestions: [
          'Make sure your JSON is properly formatted',
          `Example: ${flagName} '{"name": "My Item", "value": 123}'`,
        ],
      });
    }
  }

  private validateRequestBody(
    endpoint: Endpoint,
    dataFlag: string | undefined,
    args: { resource: string; method: string },
  ): void {
    const acceptsBody = Boolean(endpoint.requestBodyType);
    const requiresBody = acceptsBody && !endpoint.optionalRequestBody;

    // User provided --data but endpoint doesn't accept it
    if (dataFlag && !acceptsBody) {
      this.error(
        `Method "${args.method}" does not accept a request body (--data flag).`,
      );
    }

    // Endpoint requires --data but user didn't provide it
    if (requiresBody && !dataFlag) {
      this.error(
        `Method "${args.method}" requires a request body (--data flag).`,
        {
          suggestions: [
            'Provide request body data using the --data flag',
            `Example: ${this.config.bin} ${this.id} ${args.resource} ${args.method} --data '{"key": "value"}'`,
            ...(endpoint.docUrl ? [`See: ${endpoint.docUrl}`] : []),
          ],
        },
      );
    }
  }

  private parseQueryParams(
    paramsFlag: string | undefined,
  ): Record<string, unknown> {
    return paramsFlag
      ? (this.parseJsonFlag(paramsFlag, '--params') as Record<string, unknown>)
      : {};
  }

  private async executeApiCall(
    resource: Resource,
    endpoint: Endpoint,
    methodName: string,
    urlPlaceholders: Record<string, string>,
    bodyData: unknown,
    queryParams: Record<string, unknown>,
  ): Promise<unknown> {
    const resourceClient = this.getResourceClient(resource);
    const method = this.getMethod(resourceClient, resource, methodName);
    const methodArgs = this.buildMethodArguments(
      endpoint,
      urlPlaceholders,
      bodyData,
      queryParams,
    );

    try {
      const boundMethod = (
        method as (...args: unknown[]) => Promise<unknown>
      ).bind(resourceClient);

      return await boundMethod(...methodArgs);
    } catch (error) {
      this.handleApiError(error, endpoint);
      throw error;
    }
  }

  private handleApiError(error: unknown, endpoint: Endpoint): void {
    if (error instanceof CmaClient.ApiError) {
      this.error(`API Error: ${error.message}`, {
        suggestions: [
          'Check your API token has the necessary permissions',
          'Verify the request data is correctly formatted',
          `See: ${
            endpoint.docUrl ||
            'https://www.datocms.com/docs/content-management-api'
          }`,
        ],
      });
    }
  }

  private getResourceClient(resource: Resource): Record<string, unknown> {
    const resourceClient = (this.client as unknown as Record<string, unknown>)[
      resource.namespace
    ];

    if (!resourceClient) {
      this.error(
        `Could not find client for resource "${resource.jsonApiType}".`,
        {
          suggestions: [
            `Expected client property: ${resource.namespace}`,
            'This might be an internal error. Please report this issue.',
          ],
        },
      );
    }

    return resourceClient as Record<string, unknown>;
  }

  private getMethod(
    resourceClient: Record<string, unknown>,
    resource: Resource,
    methodName: string,
  ): unknown {
    const method = resourceClient[methodName];

    if (typeof method !== 'function') {
      this.error(
        `Method "${methodName}" is not available on the ${resource.namespace} client.`,
        {
          suggestions: [
            'This might be an internal error. Please report this issue.',
          ],
        },
      );
    }

    return method;
  }

  private buildMethodArguments(
    endpoint: Endpoint,
    urlPlaceholders: Record<string, string>,
    bodyData: unknown,
    queryParams: Record<string, unknown>,
  ): unknown[] {
    const methodArgs: unknown[] = [];

    // 1. Add URL placeholder values (if any)
    if (endpoint.urlPlaceholders && endpoint.urlPlaceholders.length > 0) {
      const placeholderValues = endpoint.urlPlaceholders.map(
        (p) => urlPlaceholders[p.variableName],
      );
      methodArgs.push(...placeholderValues);
    }

    // 2. Add request body (if endpoint accepts it)
    if (endpoint.requestBodyType) {
      methodArgs.push(bodyData);
    }

    // 3. Always add query parameters as last argument
    methodArgs.push(queryParams);

    return methodArgs;
  }

  /**
   * Check if a user input matches a resource name
   * Matches against both jsonApiType (e.g., "role", "item_type") and
   * namespace (e.g., "roles", "itemTypes")
   */
  private matchesResourceName(resource: Resource, userInput: string): boolean {
    const normalizedInput = this.normalizeString(userInput);
    return (
      this.normalizeString(resource.jsonApiType) === normalizedInput ||
      this.normalizeString(resource.namespace) === normalizedInput
    );
  }

  private normalizeString(str: string): string {
    return str.toLowerCase().replace(/[_-]/g, '');
  }

  /**
   * Get suggestions for similar resource names
   */
  private getResourceSuggestions(
    resources: Resource[],
    _input: string,
  ): string[] {
    const suggestions: string[] = ['Available resources:'];

    // Group by common prefixes
    const resourceNames = resources
      .map((r) => r.jsonApiType)
      .sort()
      .map((name) => `  - ${name}`)
      .slice(0, 20);

    return [...suggestions, ...resourceNames];
  }

  /**
   * Get suggestions for similar method names
   */
  private getMethodSuggestions(resource: Resource, _input: string): string[] {
    const suggestions: string[] = [
      `Available methods for ${resource.jsonApiType}:`,
    ];

    const methodNames = resource.endpoints
      .flatMap((e) => {
        const methods = [`  - ${e.rawName}: ${e.comment}`];
        // Include simple method name if available
        if (e.name) {
          methods.push(`  - ${e.name}: ${e.comment} (simple variant)`);
        }
        return methods;
      })
      .slice(0, 20);

    return [...suggestions, ...methodNames];
  }
}

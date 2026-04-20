import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CmaClientCommand, oclif } from '@datocms/cli-utils';
import { validateScriptStructure } from '../../utils/script-workspace/validation';
import { ScriptWorkspace } from '../../utils/script-workspace/workspace';

export default class Command extends CmaClientCommand {
  static description =
    'Run a one-off TypeScript script against the Content Management API.\n' +
    '\n' +
    'Two formats are accepted:\n' +
    '  A) A module exporting a default async function of\n' +
    '     (client: Client) => Promise<void>. Portable, compatible with\n' +
    '     migrations:run.\n' +
    '  B) A plain script using top-level await. `client` (a pre-authenticated\n' +
    '     CMA client) and `Schema` (project-specific ItemTypeDefinition types,\n' +
    '     e.g. `Schema.BlogPost`) are available as ambient globals. Ideal for\n' +
    '     stdin one-liners.\n' +
    '\n' +
    'Scripts are type-checked with `tsc --noEmit` before execution. `any`\n' +
    'and `unknown` are rejected — use `Schema.*` types for record operations.\n' +
    '\n' +
    'Available npm packages (pre-installed, importable in both formats):\n' +
    '  - @datocms/cma-client-node\n' +
    '  - datocms-html-to-structured-text\n' +
    '  - datocms-structured-text-utils\n' +
    '  - datocms-structured-text-to-plain-text\n' +
    '  - datocms-structured-text-to-html-string\n' +
    '  - datocms-structured-text-to-markdown\n' +
    '  - parse5\n' +
    '\n' +
    'Use `console.log()` for output. stdout is piped through cleanly so the\n' +
    'command composes with `| jq` and similar.';

  static examples = [
    {
      description: 'Format A — default export, run from a file',
      command: '<%= config.bin %> <%= command.id %> --file ./my-script.ts',
    },
    {
      description: 'Format B — one-liner via stdin',
      command:
        "echo 'console.log((await client.itemTypes.list()).map(t => t.api_key))' | <%= config.bin %> <%= command.id %>",
    },
    {
      description: 'Format A — inline heredoc with typed client',
      command:
        "<%= config.bin %> <%= command.id %> <<'EOF'\n" +
        "import type { Client } from '@datocms/cma-client-node';\n" +
        'export default async function(client: Client) {\n' +
        '  const itemTypes = await client.itemTypes.list();\n' +
        '  console.log(itemTypes.map((t) => t.api_key));\n' +
        '}\n' +
        'EOF',
    },
    {
      description: 'Format B — type-safe record creation using Schema',
      command:
        "<%= config.bin %> <%= command.id %> <<'EOF'\n" +
        'await client.items.create<Schema.Article>({\n' +
        "  item_type: { id: 'ABC123', type: 'item_type' },\n" +
        "  title: 'Hello world',\n" +
        '});\n' +
        'EOF',
    },
    {
      description: 'Pipe output into jq',
      command:
        "echo 'console.log(JSON.stringify(await client.itemTypes.list()))' | <%= config.bin %> <%= command.id %> 2>/dev/null | jq '.[].api_key'",
    },
  ];

  static flags = {
    ...CmaClientCommand.flags,
    environment: oclif.Flags.string({
      char: 'e',
      description: 'Environment to execute the script against',
      required: false,
    }),
    file: oclif.Flags.string({
      char: 'f',
      description:
        'Path to a TypeScript file to run. If omitted, the script is read from stdin.',
      required: false,
    }),
    timeout: oclif.Flags.integer({
      description:
        'Kill the script if it runs longer than this many seconds. Default: no timeout.',
      required: false,
    }),
    'rebuild-workspace': oclif.Flags.boolean({
      description:
        'Wipe and rebuild the internal workspace (node_modules, tsconfig). Use after a CLI upgrade if scripts fail with module resolution errors.',
      required: false,
      default: false,
    }),
    'skip-validation': oclif.Flags.boolean({
      description: 'Skip TypeScript type-checking before execution',
      required: false,
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Command);

    const content = await this.readScriptSource(flags.file);
    this.validateStructure(content);

    const client = await this.buildClient({ environment: flags.environment });

    const workspace = new ScriptWorkspace();

    this.startSpinner('Preparing script workspace');
    try {
      await workspace.ensure({ rebuild: flags['rebuild-workspace'] });
    } catch (err) {
      this.stopSpinnerWithFailure();
      throw err;
    }
    this.stopSpinner();

    this.startSpinner('Generating schema types');
    const { scriptPath } = await workspace.writeScriptAndSchema(
      client,
      content,
    );
    this.stopSpinner();

    try {
      if (!flags['skip-validation']) {
        this.startSpinner('Type-checking script');
        const validation = await workspace.validate();
        if (!validation.passed) {
          this.stopSpinnerWithFailure();
          this.log();
          this.log(validation.output);
          this.error('Script failed TypeScript validation', {
            suggestions: [
              'Fix the errors above and try again',
              'Use --skip-validation to run without type-checking',
            ],
          });
        }
        this.stopSpinner();
      }

      const timeoutMs =
        typeof flags.timeout === 'number' ? flags.timeout * 1000 : undefined;

      const apiInit = await this.buildBaseClientInitializationOptions();

      const result = await workspace.execute(scriptPath, {
        apiToken: apiInit.apiToken,
        environment: flags.environment,
        baseUrl: apiInit.baseUrl,
        timeoutMs,
      });

      if (!result.success) {
        if (result.cause === 'timeout') {
          this.error(
            `Script exceeded the timeout of ${flags.timeout} seconds and was terminated`,
          );
        }
        if (result.cause === 'error') {
          this.error(`Failed to spawn script runner: ${result.error}`);
        }
        this.exit(result.exitCode || 1);
      }
    } finally {
      await workspace.cleanupScript(scriptPath);
    }
  }

  private async readScriptSource(filePath?: string): Promise<string> {
    if (filePath) {
      try {
        return readFileSync(resolve(process.cwd(), filePath), 'utf-8');
      } catch (err) {
        this.error(
          `Could not read script from "${filePath}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (process.stdin.isTTY) {
      this.error('No script provided', {
        suggestions: [
          'Pass a file path with --file <path>',
          'Pipe the script via stdin: `cat my-script.ts | datocms cma:script`',
        ],
      });
    }

    return new Promise<string>((resolveFn, rejectFn) => {
      const chunks: Buffer[] = [];
      process.stdin.on('data', (chunk) => chunks.push(chunk));
      process.stdin.on('end', () =>
        resolveFn(Buffer.concat(chunks).toString('utf-8')),
      );
      process.stdin.on('error', rejectFn);
    });
  }

  private validateStructure(content: string): void {
    const validation = validateScriptStructure(content);
    if (validation.valid) return;

    this.error('Script has structural issues', {
      suggestions: [
        ...validation.errors,
        'Supported formats:',
        '  A) `export default async function(client: Client) { ... }`',
        '  B) plain top-level code using `client` and `Schema` as globals',
      ],
    });
  }
}

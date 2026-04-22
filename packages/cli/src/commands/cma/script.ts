import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { CmaClientCommand, oclif } from '@datocms/cli-utils';
import { require as tsxRequire } from 'tsx/cjs/api';
import {
  type ScriptFormat,
  validateScriptStructure,
} from '../../utils/script-workspace/validation';
import { ScriptWorkspace } from '../../utils/script-workspace/workspace';

type ParsedFlags = {
  environment?: string;
  file?: string;
  timeout?: number;
  'rebuild-workspace': boolean;
  'skip-validation': boolean;
};

export default class Command extends CmaClientCommand {
  static description =
    'Run a one-off TypeScript script against the Content Management API.\n' +
    '\n' +
    'Two modes of invocation, different ergonomics:\n' +
    '\n' +
    '  File-mode  — Pass a .ts file path. The script must export a default\n' +
    '               async function `(client: Client) => Promise<void>`.\n' +
    '               It is loaded from its original location (via tsx), which\n' +
    "               means imports resolve against your project's node_modules\n" +
    '               and your editor LSP gives you full type feedback. No\n' +
    '               typecheck is performed before execution — same behavior as\n' +
    '               `migrations:run`. Use it for scripts that are long enough\n' +
    '               that a shell heredoc becomes awkward, use local helper\n' +
    '               modules, or need to be rerunnable by filename.\n' +
    '\n' +
    '  Stdin-mode — Pipe plain top-level-await code via stdin. `client` (a\n' +
    '               pre-authenticated CMA client) and, on-demand, `Schema`\n' +
    '               (project-specific ItemTypeDefinition types) are available\n' +
    '               as ambient globals. `export default` is not supported here.\n' +
    '               Ideal for throwaway one-liners and pipes.\n' +
    '\n' +
    'These are *both* for one-off, throwaway work. If you need to commit and\n' +
    'replay a script across environments, use `migrations:new` /\n' +
    '`migrations:run` instead.\n' +
    '\n' +
    'Source validation (both modes):\n' +
    '  - Explicit `any` / `unknown` types are rejected. Use specific types.\n' +
    '  - File-mode: script must have a default export; top-level is rejected.\n' +
    '  - Stdin-mode: script must be top-level; default export is rejected.\n' +
    '\n' +
    'Stdin-mode — pre-installed packages (importable only here):\n' +
    '  - @datocms/cma-client-node\n' +
    '  - datocms-html-to-structured-text\n' +
    '  - datocms-structured-text-utils\n' +
    '  - datocms-structured-text-to-plain-text\n' +
    '  - datocms-structured-text-to-html-string\n' +
    '  - datocms-structured-text-to-markdown\n' +
    '  - parse5\n' +
    'In file-mode you have your own `node_modules` — install whatever you\n' +
    'need there.\n' +
    '\n' +
    'Use `console.log()` for output. stdout is piped through cleanly so the\n' +
    'command composes with `| jq` and similar.';

  static examples = [
    {
      description: 'File-mode — run a script from a file',
      command: '<%= config.bin %> <%= command.id %> ./my-script.ts',
    },
    {
      description: 'Same as above, using the --file flag',
      command: '<%= config.bin %> <%= command.id %> --file ./my-script.ts',
    },
    {
      description:
        "File-mode — typical script shape (requires `datocms` installed in the script's project)",
      command:
        "<%= config.bin %> <%= command.id %> <<'EOF' > ./my-script.ts && <%= config.bin %> <%= command.id %> ./my-script.ts\n" +
        "import type { Client } from 'datocms/lib/cma-client-node';\n" +
        'export default async function(client: Client) {\n' +
        '  const itemTypes = await client.itemTypes.list();\n' +
        '  console.log(itemTypes.map((t) => t.api_key));\n' +
        '}\n' +
        'EOF',
    },
    {
      description: 'Stdin-mode — one-liner via pipe',
      command:
        "echo 'console.log((await client.itemTypes.list()).map(t => t.api_key))' | <%= config.bin %> <%= command.id %>",
    },
    {
      description:
        'Stdin-mode — type-safe record creation using the ambient Schema',
      command:
        "<%= config.bin %> <%= command.id %> <<'EOF'\n" +
        'await client.items.create<Schema.Article>({\n' +
        "  item_type: { id: 'ABC123', type: 'item_type' },\n" +
        "  title: 'Hello world',\n" +
        '});\n' +
        'EOF',
    },
    {
      description: 'Stdin-mode — pipe output into jq',
      command:
        "echo 'console.log(JSON.stringify(await client.itemTypes.list()))' | <%= config.bin %> <%= command.id %> 2>/dev/null | jq '.[].api_key'",
    },
  ];

  static args = {
    file: oclif.Args.string({
      description:
        'Path to a TypeScript file to run (file-mode). Alternative to --file. If omitted and --file is not set, the script is read from stdin (stdin-mode).',
      required: false,
      // Prevent oclif from auto-filling this from piped stdin. We read stdin
      // ourselves in stdin-mode; letting oclif consume it would swallow the
      // script and misroute the run into a "file not found" error.
      ignoreStdin: true,
    }),
  };

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
        'Path to a TypeScript file to run (file-mode). If omitted, the script is read from stdin (stdin-mode).',
      required: false,
    }),
    timeout: oclif.Flags.integer({
      description:
        'Kill the script if it runs longer than this many seconds. Default: no timeout.',
      required: false,
    }),
    'rebuild-workspace': oclif.Flags.boolean({
      description:
        'Stdin-mode only: wipe and rebuild the internal workspace (node_modules, tsconfig). Use after a CLI upgrade if stdin scripts fail with module resolution errors.',
      required: false,
      default: false,
    }),
    'skip-validation': oclif.Flags.boolean({
      description:
        'Skip source validation and (stdin-mode only) TypeScript type-checking before execution',
      required: false,
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Command);

    if (flags.file && args.file && flags.file !== args.file) {
      this.error(
        `Conflicting file paths: --file "${flags.file}" vs positional "${args.file}"`,
        {
          suggestions: [
            'Pass the file path once, either as --file or as a positional argument',
          ],
        },
      );
    }

    const filePath = flags.file ?? args.file;

    if (filePath) {
      await this.runFileMode(filePath, flags);
    } else {
      await this.runStdinMode(flags);
    }
  }

  private async runFileMode(
    filePath: string,
    flags: ParsedFlags,
  ): Promise<void> {
    const absolutePath = resolve(process.cwd(), filePath);

    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf-8');
    } catch (err) {
      this.error(
        `Could not read script from "${filePath}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (!flags['skip-validation']) {
      this.validateSource(content, {
        allowedPackages: null,
        requiredFormat: 'default-export',
      });
    }

    const client = await this.buildClient({ environment: flags.environment });

    const timeoutHandle = this.scheduleTimeout(flags.timeout);

    let exported: unknown;
    try {
      exported = tsxRequire(absolutePath, __filename);
    } catch (err) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.handleFileModeLoadError(err, absolutePath);
    }

    const defaultExport = this.extractDefaultExport(exported);
    if (!defaultExport) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.error('Script does not export a valid default function', {
        suggestions: [
          'Add `export default async function(client) { ... }` to the script',
          'For top-level-await scripts, pipe the source via stdin instead of passing a file path',
        ],
      });
    }

    try {
      await defaultExport(client);
    } catch (err) {
      if (err instanceof Error) {
        this.log();
        this.log('----');
        this.log(err.stack ?? err.message);
        this.log('----');
        this.log();
      }
      this.error(`Script "${relative(process.cwd(), absolutePath)}" failed`);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private async runStdinMode(flags: ParsedFlags): Promise<void> {
    const content = await this.readStdin();

    if (!flags['skip-validation']) {
      this.validateSource(content, {
        allowedPackages: undefined,
        requiredFormat: 'top-level',
      });
    }

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

    const needsSchema = /\bSchema\./.test(content);

    if (needsSchema) {
      this.startSpinner('Generating schema types');
    } else {
      this.startSpinner('Preparing script');
    }
    const { scriptPath } = await workspace.writeScriptAndSchema(
      client,
      content,
      { generateSchema: needsSchema },
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

  private validateSource(
    content: string,
    options: {
      allowedPackages: string[] | null | undefined;
      requiredFormat: ScriptFormat;
    },
  ): void {
    const result = validateScriptStructure(content, {
      allowedPackages: options.allowedPackages,
      requiredFormat: options.requiredFormat,
    });
    if (result.valid) return;

    const message =
      result.errors.length === 1
        ? result.errors[0]!
        : `Script has structural issues:\n${result.errors
            .map((e) => `  • ${e}`)
            .join('\n')}`;

    this.error(message);
  }

  private scheduleTimeout(
    timeoutSeconds: number | undefined,
  ): NodeJS.Timeout | undefined {
    if (typeof timeoutSeconds !== 'number' || timeoutSeconds <= 0) {
      return undefined;
    }
    return setTimeout(() => {
      this.error(
        `Script exceeded the timeout of ${timeoutSeconds} seconds and was terminated`,
      );
    }, timeoutSeconds * 1000);
  }

  private extractDefaultExport(
    exported: unknown,
  ): ((client: unknown) => Promise<void> | void) | undefined {
    if (typeof exported === 'function') {
      return exported as (client: unknown) => Promise<void> | void;
    }
    if (exported && typeof exported === 'object' && 'default' in exported) {
      const fn = (exported as { default?: unknown }).default;
      if (typeof fn === 'function') {
        return fn as (client: unknown) => Promise<void> | void;
      }
    }
    return undefined;
  }

  private handleFileModeLoadError(err: unknown, absolutePath: string): never {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string } | null)?.code;

    if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      const match = message.match(/[Cc]annot find module ['"]([^'"]+)['"]/);
      const missingModule = match?.[1];
      const scriptDir = dirname(absolutePath);

      if (
        missingModule === 'datocms' ||
        missingModule === 'datocms/lib/cma-client-node' ||
        missingModule === '@datocms/cli' ||
        missingModule === '@datocms/cli/lib/cma-client-node'
      ) {
        this.error(`Cannot resolve "${missingModule}" from the script`, {
          suggestions: [
            `Install it in the script's project: cd "${scriptDir}" && npm i datocms`,
          ],
        });
      }

      if (
        missingModule &&
        (missingModule.startsWith('./') || missingModule.startsWith('../'))
      ) {
        const isSchemaLike =
          /schema/i.test(missingModule) ||
          /datocms-schema/i.test(missingModule);
        if (isSchemaLike) {
          this.error(
            `Cannot resolve local module "${missingModule}" imported by the script`,
            {
              suggestions: [
                `Generate schema types with: datocms schema:generate ${missingModule}.ts`,
                'Or remove `Schema.*` usages from the script if you do not need typed records',
              ],
            },
          );
        }
        this.error(
          `Cannot resolve local module "${missingModule}" imported by the script`,
          {
            suggestions: [
              `Check the path is correct relative to ${absolutePath}`,
            ],
          },
        );
      }

      this.error(`Cannot resolve "${missingModule ?? 'a module'}"`, {
        suggestions: [
          "Install the missing package in your script's project",
          'Make sure the script is inside a directory that resolves to a valid node_modules',
        ],
      });
    }

    throw err;
  }

  private async readStdin(): Promise<string> {
    if (process.stdin.isTTY) {
      this.error('No script provided', {
        suggestions: [
          'Pass a file path as a positional argument: `datocms cma:script <path>`',
          'Or use the --file flag: `datocms cma:script --file <path>`',
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
}

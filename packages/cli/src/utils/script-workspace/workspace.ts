import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CmaClient } from '@datocms/cli-utils';
import envPaths from 'env-paths';
import { generateSchemaTypes } from '../schema-types-generator';
import { withLock } from './locks';

const WORKSPACE_LOCK_NAME = 'script-workspace-init';
const RUNS_DIRNAME = 'runs';
const VERSION_FILENAME = '.cli-version';

export interface EnsureResult {
  rebuilt: boolean;
  installed: boolean;
}

export interface ValidationOutput {
  passed: boolean;
  output: string;
}

export type ExecutionResult =
  | { success: true }
  | { success: false; cause: 'exitCode'; exitCode: number }
  | { success: false; cause: 'timeout' }
  | { success: false; cause: 'error'; error: string };

export interface WorkspaceOptions {
  rebuild?: boolean;
}

/**
 * Manages the isolated workspace used to run one-off cma:script invocations.
 * The workspace lives in the user's platform data dir and owns its own
 * node_modules with @datocms/cma-client-node / tsx / typescript versions
 * synced from whatever the CLI currently resolves.
 *
 * Concurrent invocations are isolated via per-run subdirectories under
 * `runs/<uuid>/`: each contains its own `schema.ts`, `script.ts`, and
 * `tsconfig.json` so `tsc --noEmit` only sees that run's files. Heavy bits
 * (`node_modules`, `runner.ts`, `globals.d.ts`, `package.json`) stay shared
 * at the workspace root.
 */
export class ScriptWorkspace {
  readonly rootPath: string;
  readonly runsPath: string;

  constructor(rootPath?: string) {
    this.rootPath =
      rootPath ??
      path.join(
        envPaths('datocms-cli', { suffix: '' }).data,
        'script-workspace',
      );
    this.runsPath = path.join(this.rootPath, RUNS_DIRNAME);
  }

  async ensure(opts: WorkspaceOptions = {}): Promise<EnsureResult> {
    return withLock(
      WORKSPACE_LOCK_NAME,
      async () => {
        const cliVersion = this.getCliVersion();
        const versionFile = path.join(this.rootPath, VERSION_FILENAME);
        const recordedVersion = (await this.readFileSafe(versionFile))?.trim();
        const rootExists = await this.fileExists(this.rootPath);
        // Missing version file on a pre-existing root means a legacy (or
        // crashed) workspace from before version-tracking was introduced —
        // treat it as a mismatch so we wipe stale shape (e.g. legacy
        // `scripts/` dir, root `tsconfig.json`).
        const versionMismatch = rootExists && recordedVersion !== cliVersion;

        const shouldRebuild = opts.rebuild || versionMismatch;

        if (shouldRebuild) {
          await fs.rm(this.rootPath, { recursive: true, force: true });
        }

        await fs.mkdir(this.rootPath, { recursive: true });
        await fs.mkdir(this.runsPath, { recursive: true });

        const pkgChanged = await this.writePackageJson();
        await this.writeGlobalsDeclaration();
        await this.writeRunner();

        const nodeModulesExists = await this.fileExists(
          path.join(this.rootPath, 'node_modules'),
        );

        const needsInstall = shouldRebuild || pkgChanged || !nodeModulesExists;

        if (needsInstall) {
          await this.installDeps();
        }

        await fs.writeFile(versionFile, cliVersion, { encoding: 'utf8' });

        return { rebuilt: shouldRebuild, installed: needsInstall };
      },
      { timeoutMs: 5 * 60 * 1000 },
    );
  }

  async writeScriptAndSchema(
    client: CmaClient.Client,
    scriptContent: string,
    options: { generateSchema?: boolean } = {},
  ): Promise<{ runDir: string; scriptPath: string; schemaPath: string }> {
    const { generateSchema = true } = options;

    const runDir = path.join(this.runsPath, randomUUID());
    await fs.mkdir(runDir, { recursive: true });

    const schemaPath = path.join(runDir, 'schema.ts');
    const schemaTypes = generateSchema
      ? await generateSchemaTypes(client, { wrapInGlobalNamespace: true })
      : '// Schema types not generated (script does not reference `Schema.*`).\ndeclare global {\n  namespace Schema {}\n}\nexport {};\n';
    await fs.writeFile(schemaPath, schemaTypes, { encoding: 'utf8' });

    const scriptPath = path.join(runDir, 'script.ts');
    await fs.writeFile(scriptPath, scriptContent, { encoding: 'utf8' });

    await this.writeRunTsConfig(runDir);

    return { runDir, scriptPath, schemaPath };
  }

  async cleanupRun(runDir: string): Promise<void> {
    await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
  }

  async validate(runDir: string): Promise<ValidationOutput> {
    return new Promise((resolve, reject) => {
      const tsc = spawn(
        'npx',
        ['tsc', '--noEmit', '-p', '.', '--pretty', 'false'],
        { cwd: runDir, env: process.env },
      );

      let stdout = '';
      let stderr = '';

      tsc.stdout?.on('data', (b) => {
        stdout += b.toString();
      });
      tsc.stderr?.on('data', (b) => {
        stderr += b.toString();
      });
      tsc.on('error', reject);
      tsc.on('close', (code) => {
        resolve({
          passed: (code ?? 1) === 0,
          output: `${stderr}${stdout}`.trim(),
        });
      });
    });
  }

  async execute(
    scriptPath: string,
    opts: {
      apiToken: string;
      environment?: string;
      baseUrl?: string;
      timeoutMs?: number;
    },
  ): Promise<ExecutionResult> {
    const runnerPath = path.join(this.rootPath, 'runner.ts');

    return new Promise<ExecutionResult>((resolve) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        DATOCMS_API_TOKEN: opts.apiToken,
      };
      if (opts.environment) env.DATOCMS_ENVIRONMENT = opts.environment;
      if (opts.baseUrl) env.DATOCMS_BASE_URL = opts.baseUrl;

      const child = spawn('npx', ['tsx', runnerPath, scriptPath], {
        cwd: this.rootPath,
        env,
        stdio: 'inherit',
      });

      let timedOut = false;
      const killTimer =
        typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0
          ? setTimeout(() => {
              timedOut = true;
              child.kill('SIGKILL');
            }, opts.timeoutMs)
          : undefined;

      child.on('close', (code) => {
        if (killTimer) clearTimeout(killTimer);

        if (timedOut) {
          resolve({ success: false, cause: 'timeout' });
          return;
        }

        if (code && code !== 0) {
          resolve({ success: false, cause: 'exitCode', exitCode: code });
          return;
        }

        resolve({ success: true });
      });

      child.on('error', (error) => {
        if (killTimer) clearTimeout(killTimer);
        resolve({ success: false, cause: 'error', error: error.message });
      });
    });
  }

  private async installDeps(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npm', ['install', '--no-audit', '--no-fund'], {
        cwd: this.rootPath,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr?.on('data', (b) => {
        stderr += b.toString();
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `npm install failed in workspace (exit ${code}): ${stderr.trim()}`,
            ),
          );
        }
      });
      child.on('error', reject);
    });
  }

  private async writePackageJson(): Promise<boolean> {
    const cmaClientNodeVersion = this.resolveDepVersion(
      '@datocms/cma-client-node',
    );
    const tsxVersion = this.resolveDepVersion('tsx');
    const typescriptVersion = this.resolveDepVersion('typescript');

    const pkg = {
      name: 'datocms-cli-script-workspace',
      private: true,
      type: 'module',
      dependencies: {
        '@datocms/cma-client-node': `^${cmaClientNodeVersion}`,
        'datocms-html-to-structured-text': '^5.1.8',
        'datocms-structured-text-utils': '^5.1.7',
        'datocms-structured-text-to-plain-text': '^5.1.7',
        'datocms-structured-text-to-html-string': '^5.1.7',
        'datocms-structured-text-to-markdown': '^5.1.7',
        parse5: '^8.0.1',
      },
      devDependencies: {
        '@types/node': '^24.10.1',
        tsx: `^${tsxVersion}`,
        typescript: `^${typescriptVersion}`,
      },
    };

    const serialized = `${JSON.stringify(pkg, null, 2)}\n`;
    const pkgPath = path.join(this.rootPath, 'package.json');
    const existing = await this.readFileSafe(pkgPath);

    if (existing === serialized) {
      return false;
    }

    await fs.writeFile(pkgPath, serialized, { encoding: 'utf8' });
    return true;
  }

  private async writeRunTsConfig(runDir: string): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        noEmit: true,
      },
      include: ['./schema.ts', './script.ts', '../../globals.d.ts'],
    };

    const serialized = `${JSON.stringify(tsConfig, null, 2)}\n`;
    await fs.writeFile(path.join(runDir, 'tsconfig.json'), serialized, {
      encoding: 'utf8',
    });
  }

  private getCliVersion(): string {
    const pkgPath = path.join(__dirname, '..', '..', '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
  }

  private async writeRunner(): Promise<void> {
    const runner = `import { buildClient } from '@datocms/cma-client-node';

async function main() {
  const scriptPath = process.argv[2];
  const apiToken = process.env['DATOCMS_API_TOKEN'];
  const environment = process.env['DATOCMS_ENVIRONMENT'];
  const baseUrl = process.env['DATOCMS_BASE_URL'];

  if (!scriptPath) {
    console.error('Missing script path argument');
    process.exit(2);
  }

  if (!apiToken) {
    console.error('Missing DATOCMS_API_TOKEN environment variable');
    process.exit(2);
  }

  const client = buildClient({ apiToken, environment, baseUrl });

  // Expose client as ambient global for Format B (top-level) scripts.
  // Schema is types-only, so no runtime binding is needed.
  (globalThis as unknown as { client: typeof client }).client = client;

  const scriptUrl = scriptPath.startsWith('file://')
    ? scriptPath
    : 'file://' + scriptPath;

  const mod = await import(scriptUrl);

  // Format A: default export async function — call it with client.
  // Format B: no default export — script already ran via top-level await.
  if (typeof mod?.default === 'function') {
    await mod.default(client);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
`;

    const runnerPath = path.join(this.rootPath, 'runner.ts');
    const existing = await this.readFileSafe(runnerPath);
    if (existing === runner) return;
    await fs.writeFile(runnerPath, runner, { encoding: 'utf8' });
  }

  private async writeGlobalsDeclaration(): Promise<void> {
    const content = `import type { Client } from '@datocms/cma-client-node';

declare global {
  const client: Client;
}

export {};
`;

    const filePath = path.join(this.rootPath, 'globals.d.ts');
    const existing = await this.readFileSafe(filePath);
    if (existing === content) return;
    await fs.writeFile(filePath, content, { encoding: 'utf8' });
  }

  private resolveDepVersion(pkg: string): string {
    try {
      const pkgJsonPath = require.resolve(`${pkg}/package.json`);
      const version: string = JSON.parse(
        readFileSync(pkgJsonPath, 'utf-8'),
      ).version;
      return version;
    } catch {
      throw new Error(
        `Could not resolve ${pkg}/package.json — is it installed as a dependency of datocms?`,
      );
    }
  }

  private async readFileSafe(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

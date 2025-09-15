import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { CmaClientCommand, oclif } from '@datocms/cli-utils';
import { camelCase } from 'lodash';
import mkdirp from 'mkdirp';
import { diffEnvironments } from '../../utils/environments-diff';
import { findNearestFile } from '../../utils/find-nearest-file';
import { SchemaTypesGenerator } from '../../utils/schema-types-generator';

const jsTemplate = `
'use strict';

/** @param client { import("@datocms/cli/lib/cma-client-node").Client } */
module.exports = async (client) => {
  // DatoCMS migration script

  // For more examples, head to our Content Management API docs:
  // https://www.datocms.com/docs/content-management-api

  // Create an Article model:
  // https://www.datocms.com/docs/content-management-api/resources/item-type/create

  const articleModel = await client.itemTypes.create({
    name: 'Article',
    api_key: 'article',
  });

  // Create a Title field (required):
  // https://www.datocms.com/docs/content-management-api/resources/field/create

  const titleField = await client.fields.create(articleModel, {
    label: 'Title',
    api_key: 'title',
    field_type: 'string',
    validators: {
      required: {},
    },
  });

  // Create an Article record:
  // https://www.datocms.com/docs/content-management-api/resources/item/create

  const article = await client.items.create({
    item_type: articleModel,
    title: 'My first article!',
  });
}
`.trim();

const tsTemplate = `
import { Client } from '@datocms/cli/lib/cma-client-node';

export default async function(client: Client): Promise<void> {
  // DatoCMS migration script

  // For more examples, head to our Content Management API docs:
  // https://www.datocms.com/docs/content-management-api

  // Create an Article model:
  // https://www.datocms.com/docs/content-management-api/resources/item-type/create

  const articleModel = await client.itemTypes.create({
    name: 'Article',
    api_key: 'article',
  });

  // Create a Title field (required):
  // https://www.datocms.com/docs/content-management-api/resources/field/create

  const titleField = await client.fields.create(articleModel, {
    label: 'Title',
    api_key: 'title',
    field_type: 'string',
    validators: {
      required: {},
    },
  });

  // Create an Article record:
  // https://www.datocms.com/docs/content-management-api/resources/item/create

  const article = await client.items.create({
    item_type: articleModel,
    title: 'My first article!',
  });
}
`.trim();

export default class Command extends CmaClientCommand {
  static description = 'Create a new migration script';

  static flags = {
    ...CmaClientCommand.flags,
    ts: oclif.Flags.boolean({
      description: 'Forces the creation of a TypeScript migration file',
      exclusive: ['js'],
    }),
    js: oclif.Flags.boolean({
      description: 'Forces the creation of a JavaScript migration file',
      exclusive: ['ts'],
    }),
    template: oclif.Flags.string({
      description: 'Start the migration script from a custom template',
      exclusive: ['autogenerate'],
    }),
    autogenerate: oclif.Flags.string({
      description:
        "Auto-generates script by diffing the schema of two environments\n\nExamples:\n* --autogenerate=foo finds changes made to sandbox environment 'foo' and applies them to primary environment\n* --autogenerate=foo:bar finds changes made to environment 'foo' and applies them to environment 'bar'",
      exclusive: ['template'],
    }),
    schema: oclif.Flags.string({
      description:
        'Include schema definitions for models and blocks (TypeScript only). Use "all" for all item types, or specify comma-separated API keys for specific ones',
      required: false,
    }),
  };

  static args = {
    NAME: oclif.Args.string({
      description: 'The name to give to the script',
      required: true,
    }),
  };

  async run(): Promise<string> {
    const {
      flags,
      args: { NAME: scriptName },
    } = await this.parse(Command);

    this.requireDatoProfileConfig();

    const config = this.datoProfileConfig!;

    const template = config.migrations?.template
      ? resolve(dirname(this.datoConfigPath), config.migrations?.template)
      : undefined;

    const migrationsDir = config.migrations?.directory
      ? resolve(dirname(this.datoConfigPath), config.migrations?.directory)
      : resolve('./migrations');

    const migrationsTsconfig = config.migrations?.tsconfig
      ? resolve(dirname(this.datoConfigPath), config.migrations?.tsconfig)
      : undefined;

    let isTsProject = false;

    if (migrationsTsconfig) {
      isTsProject = true;
    } else {
      try {
        await findNearestFile('tsconfig.json');
        isTsProject = true;
      } catch {}
    }

    const format: 'js' | 'ts' = template
      ? (extname(template).split('.').pop()! as 'js' | 'ts')
      : flags.js
        ? ('js' as const)
        : flags.ts || isTsProject
          ? ('ts' as const)
          : ('js' as const);

    const migrationFilePath = join(
      migrationsDir,
      `${Math.floor(Date.now() / 1000)}_${camelCase(scriptName)}.${format}`,
    );

    this.startSpinner(
      `Writing "${relative(process.cwd(), migrationFilePath)}"`,
    );

    try {
      await mkdirp(migrationsDir);

      await writeFile(
        migrationFilePath,
        await this.migrationScriptContent(
          template,
          format,
          migrationFilePath,
          flags.autogenerate,
          flags.schema,
        ),
        'utf-8',
      );

      this.stopSpinner();
    } catch (e) {
      this.stopSpinnerWithFailure();

      throw e;
    }

    return migrationFilePath;
  }

  async migrationScriptContent(
    template: string | undefined,
    format: 'js' | 'ts',
    migrationFilePath: string,
    rawAutoGenerate: string | undefined,
    schemaFilter: string | undefined,
  ): Promise<string> {
    if (!rawAutoGenerate) {
      let content = template
        ? readFileSync(template, 'utf-8')
        : format === 'js'
          ? jsTemplate
          : tsTemplate;

      // Add schema types if requested (only for TypeScript)
      if (schemaFilter && format === 'ts') {
        const schemaTypes = await this.generateSchemaTypes(schemaFilter);
        content = this.addSchemaTypesToMigration(content, schemaTypes);
      }

      return content;
    }

    const allEnvironments = await this.client.environments.list();
    const primaryEnv = allEnvironments.find((env) => env.meta.primary)!;

    const [newEnvironmentId, rawOldEnvironmentId] = rawAutoGenerate.split(':');
    const oldEnvironmentId = rawOldEnvironmentId || primaryEnv.id;

    const newEnv = allEnvironments.find((env) => env.id === newEnvironmentId);

    if (!newEnv) {
      this.error(`Environment "${newEnv}" does not exist`);
    }

    const oldEnv = allEnvironments.find((env) => env.id === oldEnvironmentId);

    if (!oldEnv) {
      this.error(`Environment "${oldEnv}" does not exist`);
    }

    const newClient = await this.buildClient({ environment: newEnvironmentId });
    const oldClient = await this.buildClient({ environment: oldEnvironmentId });

    const script = await diffEnvironments({
      newClient,
      newEnvironmentId,
      oldClient,
      oldEnvironmentId,
      migrationFilePath,
      format,
    });

    return script;
  }

  private async generateSchemaTypes(schemaFilter: string): Promise<string> {
    const client = await this.buildClient();
    const generator = new SchemaTypesGenerator(client);
    const itemTypesFilter =
      schemaFilter.toLowerCase() === 'all' ? undefined : schemaFilter;

    return await generator.generateSchemaTypesForMigration({
      itemTypesFilter,
    });
  }

  private addSchemaTypesToMigration(
    content: string,
    schemaTypes: string,
  ): string {
    // Update the import to include ItemTypeDefinition
    const importMatch = content.match(
      /^import { Client } from '@datocms\/cli\/lib\/cma-client-node';/m,
    );

    let updatedContent = content;
    if (importMatch) {
      const updatedImport =
        "import { Client, ItemTypeDefinition } from '@datocms/cli/lib/cma-client-node';";
      updatedContent = updatedContent.replace(importMatch[0], updatedImport);
    }

    // Add schema types before the function declaration
    const functionMatch = updatedContent.match(
      /^export default async function/m,
    );
    if (functionMatch) {
      const insertIndex = functionMatch.index!;
      return `${updatedContent.slice(
        0,
        insertIndex,
      )}// Schema type definitions\n${schemaTypes}\n\n${updatedContent.slice(
        insertIndex,
      )}`;
    }

    // Fallback: prepend to the beginning
    return `// Schema type definitions\n${schemaTypes}\n\n${updatedContent}`;
  }
}

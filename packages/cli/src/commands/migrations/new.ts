import { oclif, CmaClientCommand, CmaClient } from '@datocms/cli-utils';
import { extname, join, relative, resolve } from 'path';
import { findNearestFile } from '../../utils/find-nearest-file';
import { camelCase, omit } from 'lodash';
import { writeFile } from 'fs/promises';
import * as mkdirp from 'mkdirp';
import { readFileSync } from 'fs';

type ItemTypeInfo = {
  entity: CmaClient.SchemaTypes.ItemType;
  fieldsByApiKey: Record<string, CmaClient.SchemaTypes.Field>;
  fieldsetsByTitle: Record<string, CmaClient.SchemaTypes.Fieldset>;
};

type Schema = {
  siteEntity: CmaClient.SchemaTypes.Site;
  itemTypesByApiKey: Record<string, ItemTypeInfo>;
};

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

export default class Command extends CmaClientCommand<typeof Command.flags> {
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
  };

  static args = [
    {
      name: 'NAME',
      description: 'The name to give to the script',
      required: true,
    },
  ];

  async run(): Promise<string> {
    const { NAME: scriptName } = this.parsedArgs;

    this.requireDatoProfileConfig();

    const config = this.datoProfileConfig!;

    const template = config.migrations?.template
      ? resolve(config.migrations?.template)
      : undefined;

    const migrationsDir = resolve(
      config.migrations?.directory || './migrations',
    );

    let isTsProject = false;
    try {
      await findNearestFile('tsconfig.json');
      isTsProject = true;
    } catch {}

    const format = template
      ? extname(template).split('.').pop()!
      : this.parsedFlags.js
      ? 'js'
      : this.parsedFlags.ts || isTsProject
      ? 'ts'
      : 'js';

    const migrationScriptPath = join(
      migrationsDir,
      `${Math.floor(Date.now() / 1000)}_${camelCase(scriptName)}.${format}`,
    );

    this.startSpinner(
      `Writing "${relative(process.cwd(), migrationScriptPath)}"`,
    );

    await mkdirp(migrationsDir);

    await writeFile(
      migrationScriptPath,
      await this.migrationScriptContent(template, format),
      'utf-8',
    );

    this.stopSpinner();

    return migrationScriptPath;
  }

  async migrationScriptContent(
    template: string | undefined,
    format: string,
  ): Promise<string> {
    if (template) {
      return readFileSync(template, 'utf-8');
    }

    const rawAutoGenerate = this.parsedFlags.autogenerate;

    if (!rawAutoGenerate) {
      return format === 'js' ? jsTemplate : tsTemplate;
    }

    const allEnvironments = await this.client.environments.list();
    const primaryEnv = allEnvironments.find((env) => env.meta.primary)!;

    const [fromEnvId, rawIntoEnvId] = rawAutoGenerate.split(':');
    const intoEnvId = rawIntoEnvId || primaryEnv.id;

    const fromEnv = allEnvironments.find((env) => env.id === fromEnvId);

    if (!fromEnv) {
      this.error(`Environment "${fromEnv}" does not exist`);
    }

    const intoEnv = allEnvironments.find((env) => env.id === intoEnvId);

    if (!intoEnv) {
      this.error(`Environment "${intoEnv}" does not exist`);
    }

    const fromClient = this.buildClient({ environment: fromEnvId });
    const intoClient = this.buildClient({ environment: intoEnvId });

    const fromSchema = await this.fetchSchema(fromClient);
    const intoSchema = await this.fetchSchema(intoClient);

    const newModelApiKeys = Object.keys(fromSchema.itemTypesByApiKey).filter(
      (apiKey) => !Object.keys(intoSchema.itemTypesByApiKey).includes(apiKey),
    );

    const destroyedModelApiKeys = Object.keys(
      intoSchema.itemTypesByApiKey,
    ).filter(
      (apiKey) => !Object.keys(fromSchema.itemTypesByApiKey).includes(apiKey),
    );

    const content = [
      ...destroyedModelApiKeys.map((apiKey) =>
        this.buildDestroyModelCall(intoSchema.itemTypesByApiKey[apiKey]),
      ),
      ...newModelApiKeys.map((apiKey) =>
        this.buildCreateModelCall(fromSchema.itemTypesByApiKey[apiKey]),
      ),
      // ...changedModels.map((model) => this.buildChangedModelCall(model)),
    ].join('\n');

    return `
    import { Client } from '@datocms/cli/lib/cma-client-node';

    export default async function(client: Client): Promise<void> {
    ${content}
    }`;
  }

  async fetchSchema(client: CmaClient.Client): Promise<Schema> {
    const response = await client.site.rawFind({
      include: 'item_types,item_types.fields,item_types.fieldsets',
    });

    const allFields = response.included!.filter(
      (x): x is CmaClient.SchemaTypes.Field => x.type === 'field',
    );
    const allFieldsets: CmaClient.SchemaTypes.Fieldset[] = [];
    // response.included!.filter(
    //   (x): x is CmaClient.SchemaTypes.Fieldset => x.type === 'fieldset',
    // );

    return {
      siteEntity: response.data,
      itemTypesByApiKey: Object.fromEntries(
        response
          .included!.filter(
            (x): x is CmaClient.SchemaTypes.ItemType => x.type === 'item_type',
          )
          .map((itemType) => [
            itemType.attributes.api_key,
            {
              entity: itemType,
              fieldsByApiKey: Object.fromEntries(
                allFields
                  .filter(
                    (f) => f.relationships.item_type.data.id === itemType.id,
                  )
                  .map((field) => [field.attributes.api_key, field]),
              ),
              fieldsetsByTitle: Object.fromEntries(
                allFieldsets
                  .filter(
                    (f) => f.relationships.item_type.data.id === itemType.id,
                  )
                  .map((field) => [field.attributes.title, field]),
              ),
            },
          ]),
      ),
    };
  }

  buildDestroyModelCall({ entity }: ItemTypeInfo): string {
    return `await client.itemTypes.destroy('${entity.attributes.api_key}');`;
  }

  buildCreateModelCall({ entity }: ItemTypeInfo): string {
    return `const ${
      entity.attributes.api_key
    }_model = await client.itemTypes.create(${JSON.stringify({
      ...entity.attributes,
      workflow: entity.relationships.workflow.data,
    })});`;
  }

  buildCreateFieldsetCall(
    targetModel: CmaClient.SchemaTypes.ItemType,
    fieldset: CmaClient.SchemaTypes.Fieldset,
  ): string[] {
    return [
      `await client.fields.create('${
        targetModel.attributes.api_key
      }', ${JSON.stringify(fieldset.attributes)})`,
    ];
  }

  buildCreateFieldCall(
    targetModel: CmaClient.SchemaTypes.ItemType,
    field: CmaClient.SchemaTypes.Field,
  ): string[] {
    return [
      `await client.fields.create('${
        targetModel.attributes.api_key
      }', ${JSON.stringify(omit(field.attributes, ['appeareance']))})`,
    ];
  }

  buildChangedModelCall(model: CmaClient.SchemaTypes.ItemType): string {
    return `await client.itemTypes.destroy('${model.attributes.api_key}');`;
  }
}

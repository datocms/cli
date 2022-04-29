import { oclif, DatoProjectConfigCommand } from '@datocms/cli-utils';
import { join, relative, resolve } from 'path';
import { findNearestFile } from '../../utils/find-nearest-file';
import { camelCase } from 'lodash';
import { writeFile } from 'fs/promises';
import * as mkdirp from 'mkdirp';

const jsTemplate = `
'use strict';

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
import { CmaClient } from '@datocms/cli';

export default async function(client: CmaClient.Client): Promise<void> {
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

export default class Command extends DatoProjectConfigCommand<
  typeof Command.flags
> {
  static description = 'Create a new migration script';

  static flags = {
    ...DatoProjectConfigCommand.flags,
    ts: oclif.Flags.boolean({
      description: 'Forces the creation of a TypeScript migration file',
      exclusive: ['js'],
    }),
    js: oclif.Flags.boolean({
      description: 'Forces the creation of a JavaScript migration file',
      exclusive: ['ts'],
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

    this.requireDatoProjectConfig();

    const migrationsDir = resolve(
      this.datoProjectConfig!.migrationsDir || './migrations',
    );

    let isTsProject = false;
    try {
      await findNearestFile('tsconfig.json');
      isTsProject = true;
    } catch {}

    const format = this.parsedFlags.js
      ? 'js'
      : this.parsedFlags.ts || isTsProject
      ? 'ts'
      : 'js';

    const migrationScriptPath = join(
      migrationsDir,
      `${Math.floor(Date.now() / 1000)}_${camelCase(scriptName)}.${format}`,
    );

    this.startSpinner(
      `Writing ${relative(process.cwd(), migrationScriptPath)}`,
    );

    await mkdirp(migrationsDir);

    await writeFile(
      migrationScriptPath,
      format === 'js' ? jsTemplate : tsTemplate,
      'utf-8',
    );

    this.stopSpinner();

    return migrationScriptPath;
  }
}

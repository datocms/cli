import { CmaClientCommand, oclif } from '@datocms/cli-utils';
import {
  Client,
  ApiError,
  SimpleSchemaTypes,
} from '@datocms/cli-utils/dist/cma-client-node';
import { access, readdir } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { register as registerTsNode } from 'ts-node';
import { findNearestFile } from '../../utils/find-nearest-file';

const MIGRATION_FILE_REGEXP = /^\d+.*\.(js|ts)$/;

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Run migration scripts that have not run yet';

  static flags = {
    ...CmaClientCommand.flags,
    source: oclif.Flags.string({
      description: 'Forces the creation of a TypeScript migration file',
    }),
    destination: oclif.Flags.string({
      description: 'Forces the creation of a JavaScript migration file',
      exclusive: ['in-place'],
    }),
    'in-place': oclif.Flags.boolean({
      description: 'Forces the creation of a JavaScript migration file',
      exclusive: ['destination'],
    }),
    'dry-run': oclif.Flags.boolean({
      description: 'Forces the creation of a JavaScript migration file',
    }),
    'migrations-dir': oclif.Flags.string({
      description: 'Directory where script migrations are stored',
    }),
    'migrations-model': oclif.Flags.string({
      description: 'API key of the DatoCMS model used to store migration data',
    }),
  };

  private registeredTsNode?: boolean;

  async run(): Promise<{
    environmentId: string;
    runMigrationScripts: string[];
  }> {
    this.requireDatoProjectConfig();

    const preference = this.datoProjectConfig?.migrations;

    const {
      'dry-run': dryRun,
      'in-place': inPlace,
      source: sourceEnvId,
      destination: rawDestinationEnvId,
    } = this.parsedFlags;

    const migrationsDir = resolve(
      this.parsedFlags['migrations-dir'] ||
        preference?.directory ||
        './migrations',
    );

    const migrationsModelApiKey =
      this.parsedFlags['migrations-model'] ||
      preference?.modelApiKey ||
      'schema_migration';

    try {
      await access(migrationsDir);
    } catch {
      this.error(
        `Directory "${relative(process.cwd(), migrationsDir)}" does not exist!`,
      );
    }

    const allEnvironments = await this.client.environments.list();

    const primaryEnv = allEnvironments.find((env) => env.meta.primary);

    const sourceEnv = sourceEnvId
      ? await this.client.environments.find(sourceEnvId)
      : primaryEnv;

    if (!sourceEnv) {
      this.error(
        `You have no permissions to access the "${
          sourceEnvId ? `"${sourceEnvId}"` : 'primary'
        }" environment!`,
      );
    }

    const destinationEnvId = inPlace
      ? sourceEnv.id
      : rawDestinationEnvId || `${sourceEnv.id}-post-migrations`;

    if (inPlace) {
      if (primaryEnv && primaryEnv.id === destinationEnvId) {
        this.error('Running migrations on primary environment is not allowed!');
      }
    } else {
      await this.forkEnvironment(
        sourceEnv,
        destinationEnvId,
        allEnvironments,
        dryRun,
      );
    }

    this.log(
      `Migrations will be run in "${destinationEnvId}" sandbox environment`,
    );

    const envClient = this.buildClient({ environment: destinationEnvId });

    const migrationModel = await this.upsertMigrationModel(
      envClient,
      migrationsModelApiKey,
      dryRun,
    );

    const migrationScriptsToRun = await this.migrationScriptsToRun(
      migrationModel,
      envClient,
      migrationsDir,
    );

    for (const migrationScript of migrationScriptsToRun) {
      // eslint-disable-next-line no-await-in-loop
      await this.runMigrationScript(
        migrationScript,
        envClient,
        dryRun,
        migrationModel,
        migrationsDir,
      );
    }

    this.log(
      migrationScriptsToRun.length === 0
        ? `No new migration scripts to run, skipping operation`
        : `Successfully run ${migrationScriptsToRun.length} migration scripts`,
    );

    return {
      environmentId: destinationEnvId,
      runMigrationScripts: migrationScriptsToRun,
    };
  }

  private async runMigrationScript(
    path: string,
    envClient: Client,
    dryRun: boolean,
    migrationModel: SimpleSchemaTypes.ItemType | null,
    migrationsDir: string,
  ) {
    const relativePath = relative(migrationsDir, path);

    this.startSpinner(`Running migration "${relativePath}"`);

    if (!dryRun) {
      if (
        path.endsWith('.ts') &&
        !this.registeredTsNode &&
        process.env.NODE_ENV !== 'development'
      ) {
        this.registeredTsNode = true;
        const project = await findNearestFile('tsconfig.json');
        registerTsNode({ project });
      }

      const exportedThing = require(path);

      const migration: (
        client: Client,
        // eslint-disable-next-line unicorn/prefer-module
      ) => Promise<void> | undefined =
        typeof exportedThing === 'function'
          ? exportedThing
          : 'default' in exportedThing &&
            typeof exportedThing.default === 'function'
          ? exportedThing.default
          : undefined;

      if (!migration) {
        this.error('The script does not export a valid migration function');
      }

      // eslint-disable-next-line no-await-in-loop
      await migration(envClient);
    }

    this.stopSpinner();

    if (!dryRun && migrationModel) {
      // eslint-disable-next-line no-await-in-loop
      await envClient.items.create({
        item_type: migrationModel,
        name: relativePath,
      });
    }
  }

  private async migrationScriptsToRun(
    migrationModel: SimpleSchemaTypes.ItemType | null,
    envClient: Client,
    migrationsDir: string,
  ) {
    const alreadyRunMigrations = migrationModel
      ? await this.fetchAlreadyRunMigrationScripts(envClient, migrationModel)
      : [];

    const allMigrationScripts = (await readdir(migrationsDir)).filter((file) =>
      file.match(MIGRATION_FILE_REGEXP),
    );

    return allMigrationScripts
      .filter((file) => !alreadyRunMigrations.includes(file))
      .map((file) => join(migrationsDir, file))
      .sort();
  }

  private async forkEnvironment(
    sourceEnv: SimpleSchemaTypes.Environment,
    destinationEnvId: string,
    allEnvironments: SimpleSchemaTypes.Environment[],
    dryRun: boolean,
  ) {
    this.startSpinner(
      `Creating a fork of "${sourceEnv.id}" environment called "${destinationEnvId}"`,
    );

    const existingEnvironment = allEnvironments.find(
      (env) => env.id === destinationEnvId,
    );

    if (existingEnvironment) {
      this.error(`Environment "${destinationEnvId}" already exists!`, {
        suggestions: [
          'To run the migrations inside an existing environment, add the --in-place flag',
          `To delete the environment, run "${this.config.bin} environments:destroy ${destinationEnvId}"`,
        ],
      });
    }

    if (!dryRun) {
      await this.client.environments.fork(sourceEnv.id, {
        id: destinationEnvId,
      });
    }

    this.stopSpinner();
  }

  private async fetchAlreadyRunMigrationScripts(
    client: Client,
    model: SimpleSchemaTypes.ItemType,
  ) {
    const migrationScripts: string[] = [];

    for await (const item of client.items.listPagedIterator({
      filter: { type: model.id },
    })) {
      migrationScripts.push(item.name as string);
    }

    return migrationScripts;
  }

  private async upsertMigrationModel(
    client: Client,
    migrationModelApiKey: string,
    dryRun: boolean,
  ): Promise<SimpleSchemaTypes.ItemType | null> {
    try {
      return client.itemTypes.find(migrationModelApiKey);
    } catch (e) {
      if (e instanceof ApiError && e.response.status === 404) {
        this.startSpinner(`Creating "${migrationModelApiKey}" model`);

        let migrationItemType: SimpleSchemaTypes.ItemType | null = null;

        if (!dryRun) {
          migrationItemType = await this.createMigrationModel(
            client,
            migrationModelApiKey,
          );
        }

        this.stopSpinner();

        return migrationItemType;
      }

      throw e;
    }
  }

  private async createMigrationModel(
    client: Client,
    migrationModelApiKey: string,
  ): Promise<SimpleSchemaTypes.ItemType> {
    const model = await client.itemTypes.create({
      name: 'Schema migration',
      api_key: migrationModelApiKey,
      draft_mode_active: false,
    });

    await client.fields.create(model.id, {
      label: 'Migration file name',
      api_key: 'name',
      field_type: 'string',
      validators: {
        required: {},
      },
    });

    return model;
  }
}

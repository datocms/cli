import { CmaClientCommand, oclif } from '@datocms/cli-utils';
import {
  Client,
  ApiError,
  SimpleSchemaTypes,
} from '@datocms/cli-utils/lib/cma-client-node';
import { access, readdir } from 'fs/promises';
import { dirname, join, relative, resolve } from 'path';
import { register as registerTsNode } from 'ts-node';
import { findNearestFile } from '../../utils/find-nearest-file';

const MIGRATION_FILE_REGEXP = /^\d+.*\.(js|ts)$/;

export default class Command extends CmaClientCommand<typeof Command.flags> {
  static description = 'Run migration scripts that have not run yet';

  static flags = {
    ...CmaClientCommand.flags,
    source: oclif.Flags.string({
      description: 'Specify the environment to fork',
    }),
    destination: oclif.Flags.string({
      description: 'Specify the name of the new forked environment',
      exclusive: ['in-place'],
    }),
    'in-place': oclif.Flags.boolean({
      description:
        'Run the migrations in the --source environment, without forking',
      exclusive: ['destination'],
    }),
    'dry-run': oclif.Flags.boolean({
      description:
        'Simulate the execution of the migrations, without making any actual change',
    }),
    'migrations-dir': oclif.Flags.string({
      description: 'Directory where script migrations are stored',
    }),
    'migrations-model': oclif.Flags.string({
      description: 'API key of the DatoCMS model used to store migration data',
    }),
    'migrations-tsconfig': oclif.Flags.string({
      description:
        'Path of the tsconfig.json to use to run TS migrations scripts',
    }),
  };

  private registeredTsNode?: boolean;

  async run(): Promise<{
    environmentId: string;
    runMigrationScripts: string[];
  }> {
    this.requireDatoProfileConfig();

    const preference = this.datoProfileConfig?.migrations;

    const {
      'dry-run': dryRun,
      'in-place': inPlace,
      source: sourceEnvId,
      destination: rawDestinationEnvId,
    } = this.parsedFlags;

    const migrationsDir = resolve(
      this.parsedFlags['migrations-dir'] ||
        (preference?.directory
          ? resolve(dirname(this.datoConfigPath), preference?.directory)
          : undefined) ||
        './migrations',
    );

    const migrationsModelApiKey =
      this.parsedFlags['migrations-model'] ||
      preference?.modelApiKey ||
      'schema_migration';

    const migrationsTsconfig =
      this.parsedFlags['migrations-tsconfig'] ||
      (preference?.tsconfig
        ? resolve(dirname(this.datoConfigPath), preference?.tsconfig)
        : undefined);

    try {
      await access(migrationsDir);
    } catch {
      this.error(`Directory "${migrationsDir}" does not exist!`);
    }

    if (migrationsTsconfig) {
      try {
        await access(migrationsTsconfig);
      } catch {
        this.error(`File "${migrationsTsconfig}" does not exist!`);
      }
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

    let destinationEnvId = inPlace
      ? sourceEnv.id
      : rawDestinationEnvId || `${sourceEnv.id}-post-migrations`;

    this.log(
      `Migrations will be run in "${destinationEnvId}" sandbox environment`,
    );

    if (inPlace) {
      if (primaryEnv && primaryEnv.id === destinationEnvId) {
        this.error('Running migrations on primary environment is not allowed!');
      }
    } else {
      destinationEnvId = await this.forkEnvironment(
        sourceEnv,
        destinationEnvId,
        allEnvironments,
        dryRun,
      );
    }

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

    const someMigrationScriptRequiresLegacyClient = migrationScriptsToRun.some(
      (s) => s.legacy,
    );

    let legacyEnvClient = null;

    if (someMigrationScriptRequiresLegacyClient) {
      const config = this.buildBaseClientInitializationOptions();

      try {
        const libraryName = 'datocms-client';
        const { SiteClient } = await import(libraryName);
        legacyEnvClient = new SiteClient(config.apiToken, {
          environment: destinationEnvId,
        });
      } catch {
        this.error('Detected some migrations that require legacy client', {
          suggestions: ['Please add the "datocms-client" NPM package'],
        });
      }
    }

    for (const migrationScript of migrationScriptsToRun) {
      // eslint-disable-next-line no-await-in-loop
      await this.runMigrationScript(
        migrationScript,
        envClient,
        legacyEnvClient,
        dryRun,
        migrationModel,
        migrationsDir,
        migrationsTsconfig,
      );
    }

    this.log(
      migrationScriptsToRun.length === 0
        ? `No new migration scripts to run, skipping operation`
        : `Successfully run ${migrationScriptsToRun.length} migration scripts`,
    );

    return {
      environmentId: destinationEnvId,
      runMigrationScripts: migrationScriptsToRun.map((s) => s.path),
    };
  }

  private async runMigrationScript(
    script: { filename: string; path: string; legacy: boolean },
    envClient: Client,
    legacyEnvClient: unknown,
    dryRun: boolean,
    migrationModel: SimpleSchemaTypes.ItemType | null,
    migrationsDir: string,
    migrationsTsconfig: string | undefined,
  ) {
    const relativePath = relative(migrationsDir, script.path);

    this.startSpinner(`Running migration "${relativePath}"`);

    if (!dryRun) {
      if (
        script.filename.endsWith('.ts') &&
        !this.registeredTsNode &&
        process.env.NODE_ENV !== 'development'
      ) {
        this.registeredTsNode = true;
        registerTsNode({
          project:
            migrationsTsconfig || (await findNearestFile('tsconfig.json')),
        });
      }

      const exportedThing = await import(script.path);

      const migration: (client: unknown) => Promise<void> | undefined =
        typeof exportedThing === 'function'
          ? exportedThing
          : 'default' in exportedThing &&
            typeof exportedThing.default === 'function'
          ? exportedThing.default
          : undefined;

      if (!migration) {
        this.error('The script does not export a valid migration function');
      }

      try {
        await migration(script.legacy ? legacyEnvClient : envClient);
      } catch (e) {
        this.stopSpinner('failed!');

        if (e instanceof Error) {
          this.log();
          this.log('----');
          this.log(e.stack);
          this.log('----');
          this.log();
        }

        this.error(`Migration "${relativePath}" failed`);
      }
    }

    this.stopSpinner();

    if (!dryRun && migrationModel) {
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

    const allMigrationScripts = (await readdir(migrationsDir))
      .filter((file) => file.match(MIGRATION_FILE_REGEXP))
      .map((file) => ({
        filename: file,
        path: join(migrationsDir, file),
        legacy: false,
      }));

    let allLegacyMigrationScripts: Array<{
      filename: string;
      path: string;
      legacy: boolean;
    }> = [];

    try {
      const legacyMigrationsDir = join(migrationsDir, 'legacyClient');
      await access(legacyMigrationsDir);

      allLegacyMigrationScripts = (await readdir(legacyMigrationsDir))
        .filter((file) => file.match(MIGRATION_FILE_REGEXP))
        .map((file) => ({
          filename: file,
          path: join(legacyMigrationsDir, file),
          legacy: true,
        }));
    } catch {}

    return [...allMigrationScripts, ...allLegacyMigrationScripts]
      .sort((a, b) => a.filename.localeCompare(b.filename))
      .filter((script) => !alreadyRunMigrations.includes(script.filename));
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
          `To execute the migrations inside the existing environment, run "${this.config.bin} migrations:run --source=${destinationEnvId} --in-place"`,
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

    return dryRun ? sourceEnv.id : destinationEnvId;
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
      return await client.itemTypes.find(migrationModelApiKey);
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

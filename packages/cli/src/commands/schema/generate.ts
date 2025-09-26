import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CmaClientCommand, oclif } from '@datocms/cli-utils';
import { generateSchemaTypes } from '../../utils/schema-types-generator';

export default class Command extends CmaClientCommand {
  static description = 'Generate TypeScript definitions for the schema';

  static flags = {
    ...CmaClientCommand.flags,
    environment: oclif.Flags.string({
      char: 'e',
      description: 'Environment to generate schema from',
      required: false,
    }),
    'item-types': oclif.Flags.string({
      char: 't',
      description:
        'Comma-separated list of item type API keys to include (includes dependencies)',
      required: false,
    }),
  };

  static args = {
    filename: oclif.Args.string({
      description: 'Output filename for the generated TypeScript definitions',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Command);
    let { environment } = flags;
    const filename = args.filename;
    const itemTypesFilter = flags['item-types'];

    if (!environment) {
      const environments = await this.client.environments.list();
      const primaryEnv = environments.find((env) => env.meta.primary);
      if (primaryEnv) {
        environment = primaryEnv.id;
      }
    }

    const client = await this.buildClient({ environment });

    const formattedCode = await generateSchemaTypes(client, {
      itemTypesFilter,
      environment,
    });

    const outputPath = resolve(process.cwd(), filename);
    writeFileSync(outputPath, formattedCode, 'utf8');

    this.log(`Schema types generated at: ${outputPath}`);
  }
}

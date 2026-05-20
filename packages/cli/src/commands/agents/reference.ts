import { BaseCommand, oclif } from '@datocms/cli-utils';

const NAME_PATTERN = /^[a-z0-9-]+$/;
const SKILLS_BASE_URL =
  'https://raw.githubusercontent.com/datocms/agent-skills/refs/heads/master/skills/';

export default class Command extends BaseCommand {
  static hidden = true;

  static description =
    'Print a reference document from a DatoCMS agent skill. Intended for AI agents that lack the skill installed locally.';

  static examples = [
    {
      description: "Print the datocms-cma skill's editing-records reference",
      command:
        '<%= config.bin %> <%= command.id %> datocms-cma editing-records',
    },
  ];

  static args = {
    skill: oclif.Args.string({
      description: 'Skill name (e.g. `datocms-cma`)',
      required: true,
    }),
    name: oclif.Args.string({
      description: 'Reference name (e.g. `editing-records`)',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(Command);

    if (!NAME_PATTERN.test(args.skill)) {
      this.error(
        `Invalid skill name "${args.skill}": must match ${NAME_PATTERN}`,
      );
    }

    if (!NAME_PATTERN.test(args.name)) {
      this.error(
        `Invalid reference name "${args.name}": must match ${NAME_PATTERN}`,
      );
    }

    const url = `${SKILLS_BASE_URL}${args.skill}/references/${args.name}.md`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      this.error(
        `Failed to fetch reference "${args.name}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (response.status === 404) {
      this.error(`Reference "${args.name}" not found at ${url}`);
    }

    if (!response.ok) {
      this.error(
        `Failed to fetch reference "${args.name}": HTTP ${response.status} ${response.statusText}`,
      );
    }

    const body = await response.text();
    process.stdout.write(body);
    if (!body.endsWith('\n')) process.stdout.write('\n');
  }
}

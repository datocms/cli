import { BaseCommand, oclif } from '@datocms/cli-utils';

const NAME_PATTERN = /^[a-z0-9-]+$/;
const LEGACY_SKILL_DOMAINS = new Map([
  ['datocms-cda', 'cda'],
  ['datocms-cli', 'cli'],
  ['datocms-cma', 'cma'],
  ['datocms-content-modeling', 'modeling'],
  ['datocms-frontend-integrations', 'frontend'],
  ['datocms-plugin', 'plugin'],
  ['datocms-setup', 'setup'],
  ['datocms-feedback', 'feedback'],
]);
const DOMAINS = new Set(LEGACY_SKILL_DOMAINS.values());
const REFERENCES_BASE_URL =
  'https://raw.githubusercontent.com/datocms/agent-skills/b22e0f87d52bd1a20f146191ba760ce46616150e/skills/datocms/references/';

export default class Command extends BaseCommand {
  static hidden = true;

  static description =
    'Print a reference document from a DatoCMS agent skill. Intended for AI agents that lack the skill installed locally.';

  static examples = [
    {
      description: "Print the datocms skill's CMA editing-records reference",
      command:
        '<%= config.bin %> <%= command.id %> datocms cma/editing-records',
    },
  ];

  static args = {
    skill: oclif.Args.string({
      description:
        'Skill name (`datocms`, or a legacy name such as `datocms-cma`)',
      required: true,
    }),
    name: oclif.Args.string({
      description:
        'Reference path (e.g. `cma/editing-records`, or `editing-records` with a legacy skill name)',
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

    const legacyDomain = LEGACY_SKILL_DOMAINS.get(args.skill);
    if (args.skill !== 'datocms' && !legacyDomain) {
      this.error(
        `Unknown skill "${
          args.skill
        }": use "datocms" or a supported legacy skill name (${[
          ...LEGACY_SKILL_DOMAINS.keys(),
        ].join(', ')})`,
      );
    }

    const referencePath = legacyDomain
      ? `${legacyDomain}/${args.name}`
      : args.name;
    const [domain, name, ...extraSegments] = referencePath.split('/');

    if (
      !domain ||
      !DOMAINS.has(domain) ||
      !name ||
      !NAME_PATTERN.test(name) ||
      name !== name.trim() ||
      extraSegments.length > 0
    ) {
      this.error(
        `Invalid reference name "${args.name}": use ${
          legacyDomain ? 'a reference name' : '"<domain>/<name>"'
        } with ${
          legacyDomain ? '' : `domain one of ${[...DOMAINS].join(', ')} and `
        }name matching ${NAME_PATTERN}`,
      );
    }

    const url = `${REFERENCES_BASE_URL}${referencePath}.md`;

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

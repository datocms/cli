import { BaseCommand, oclif, readCredentials } from '@datocms/cli-utils';
import { type Client, buildClient } from '@datocms/dashboard-client';
import chalk from 'chalk';
import { fuzzyScore } from '../../utils/fuzzyScore';

type WorkspaceInfo = {
  type: 'personal_account' | 'organization';
  name: string;
  id: string | null;
};

type ProjectResult = {
  id: string;
  name: string;
  domain: string;
  workspace: WorkspaceInfo;
};

type EnumeratedWorkspace = {
  info: WorkspaceInfo;
  organizationId?: string;
};

const ADMIN_DOMAIN_SUFFIX = '.admin.datocms.com';

export default class Command extends BaseCommand {
  static description =
    'List DatoCMS projects accessible to the authenticated account';

  static examples = [
    '<%= config.bin %> projects:list',
    '<%= config.bin %> projects:list blog',
    '<%= config.bin %> projects:list --workspace="Acme Corp"',
    '<%= config.bin %> projects:list --json',
  ];

  static args = {
    QUERY: oclif.Args.string({
      description:
        'Fuzzy-match string. When omitted, returns up to --limit projects across all workspaces.',
      required: false,
    }),
  };

  static flags = {
    limit: oclif.Flags.integer({
      description:
        'Maximum number of results returned. Exact-match shortcut is not capped.',
      default: 20,
    }),
    workspace: oclif.Flags.string({
      description:
        'Restrict results to one workspace. Accepts "personal", an organization id, or an organization name (case-insensitive exact match).',
    }),
  };

  async run(): Promise<ProjectResult[]> {
    const { args, flags } = await this.parse(Command);

    const credentials = await readCredentials();

    if (!credentials) {
      this.error('Not logged in.', {
        suggestions: ["Run 'datocms login' to authenticate"],
      });
    }

    const baseClient = buildClient({
      apiToken: credentials.apiToken,
      ...(credentials.dashboardBaseUrl
        ? { baseUrl: credentials.dashboardBaseUrl }
        : {}),
    });

    const workspaces = await this.enumerateWorkspaces(
      baseClient,
      flags.workspace,
    );

    const allProjects = await this.fetchProjects(credentials, workspaces);

    if (allProjects.length === 0) {
      this.error('No projects found.', {
        suggestions: ['Create a project at https://dashboard.datocms.com'],
      });
    }

    const query = args.QUERY?.trim();
    const results = query
      ? this.search(allProjects, query, flags.limit)
      : allProjects.slice(0, flags.limit);

    if (query && results.length === 0) {
      this.error(`No projects match '${query}'.`, {
        suggestions: [
          "Run 'datocms projects:list' (no query) to see all accessible projects",
        ],
      });
    }

    this.printTable(results, ['id', 'name', 'domain', 'workspace.name']);

    if (!this.jsonEnabled()) {
      this.log();
      this.log(
        chalk.dim(
          `${results.length} project${
            results.length === 1 ? '' : 's'
          }. Pass --json for machine-readable output${
            query ? '' : ', or a query to filter'
          }.`,
        ),
      );
      this.log();
    }

    return results;
  }

  private async enumerateWorkspaces(
    client: Client,
    workspaceFilter: string | undefined,
  ): Promise<EnumeratedWorkspace[]> {
    const [account, organizations] = await Promise.all([
      client.account.find(),
      client.organizations.list(),
    ]);

    const all: EnumeratedWorkspace[] = [
      {
        info: {
          type: 'personal_account',
          name: 'Personal account',
          id: null,
        },
      },
      ...organizations.map((org) => ({
        info: {
          type: 'organization' as const,
          name: org.name || `Organization ${org.id}`,
          id: org.id,
        },
        organizationId: org.id,
      })),
    ];

    if (!workspaceFilter) {
      return all;
    }

    const filter = workspaceFilter.trim();
    const filterLower = filter.toLowerCase();

    const matched = all.filter((ws) => {
      if (ws.info.type === 'personal_account') {
        return (
          filterLower === 'personal' ||
          filterLower === 'personal account' ||
          filterLower === account.email.toLowerCase()
        );
      }
      return (
        ws.info.id === filter || ws.info.name.toLowerCase() === filterLower
      );
    });

    if (matched.length === 0) {
      const known = all
        .map((ws) =>
          ws.info.type === 'personal_account'
            ? '"personal"'
            : `"${ws.info.name}" (id: ${ws.info.id})`,
        )
        .join(', ');

      this.error(
        `Workspace '${workspaceFilter}' did not match any accessible workspace.`,
        {
          suggestions: [`Known workspaces: ${known}`],
        },
      );
    }

    return matched;
  }

  private async fetchProjects(
    credentials: { apiToken: string; dashboardBaseUrl?: string },
    workspaces: EnumeratedWorkspace[],
  ): Promise<ProjectResult[]> {
    const perWorkspace = await Promise.all(
      workspaces.map(async (ws) => {
        const wsClient = buildClient({
          apiToken: credentials.apiToken,
          ...(credentials.dashboardBaseUrl
            ? { baseUrl: credentials.dashboardBaseUrl }
            : {}),
          ...(ws.organizationId ? { organization: ws.organizationId } : {}),
        });

        const projects: ProjectResult[] = [];
        for await (const site of wsClient.sites.listPagedIterator()) {
          if (!site.access_token) {
            continue;
          }
          projects.push({
            id: site.id,
            name: site.name,
            domain:
              site.domain ||
              `${site.internal_subdomain ?? site.id}${ADMIN_DOMAIN_SUFFIX}`,
            workspace: ws.info,
          });
        }
        return projects;
      }),
    );

    const seen = new Set<string>();
    const deduped: ProjectResult[] = [];
    for (const project of perWorkspace.flat()) {
      if (seen.has(project.id)) {
        continue;
      }
      seen.add(project.id);
      deduped.push(project);
    }
    return deduped;
  }

  private search(
    projects: ProjectResult[],
    query: string,
    limit: number,
  ): ProjectResult[] {
    const queryLower = query.toLowerCase();

    const exact = projects.filter(
      (p) =>
        p.id === query ||
        p.name.toLowerCase() === queryLower ||
        p.domain.toLowerCase() === queryLower,
    );
    if (exact.length > 0) {
      return exact;
    }

    const scored = projects
      .map((p) => ({
        project: p,
        score: Math.max(
          fuzzyScore(queryLower, p.name.toLowerCase()),
          fuzzyScore(queryLower, shortDomain(p).toLowerCase()),
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((entry) => entry.project);
  }
}

function shortDomain(project: ProjectResult): string {
  return project.domain.endsWith(ADMIN_DOMAIN_SUFFIX)
    ? project.domain.slice(0, -ADMIN_DOMAIN_SUFFIX.length)
    : project.domain;
}

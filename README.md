<!--datocms-autoinclude-header start-->

<a href="https://www.datocms.com/"><img src="https://www.datocms.com/images/full_logo.svg" height="60"></a>

👉 [Visit the DatoCMS homepage](https://www.datocms.com) or see [What is DatoCMS?](#what-is-datocms)

---

<!--datocms-autoinclude-header end-->

# DatoCMS CLI

DatoCMS CLI tool for managing DatoCMS projects, environments and schemas.

- [@datocms/cli](https://github.com/datocms/cli/tree/main/packages/cli): Main CLI package
- [@datocms/cli-plugin-wordpress](https://github.com/datocms/cli/tree/main/packages/cli-plugin-wordpress): CLI plugin to import WordPress websites into DatoCMS projects
- [@datocms/cli-plugin-contentful](https://github.com/datocms/cli/tree/main/packages/cli-plugin-contentful): CLI plugin to import Contentful spaces into DatoCMS projects

## Development

This is an npm-workspaces monorepo: `npm install` links the packages to each
other, and Turborepo derives the build order from their dependencies, so there
is nothing to bootstrap.

```
npm install
npm run build
npm test
```

`npm test` includes the WordPress and Contentful import suites, which talk to
live APIs: they need a `.env` at the root (copy `.env.sample`) and, for
WordPress, `docker compose up` in `packages/cli-plugin-wordpress`. Each suite
checks its prerequisites first and tells you which one is missing.

## Releasing

Maintainers only. A release publishes the packages that changed, and gives them
all the same version number; the ones you didn't touch keep the version they
already had.

1. **Describe your change.** Run `npx changeset` in the same PR that makes the
   change: it asks which packages are affected and whether the bump is a
   patch/minor/major, then writes a small markdown file under `.changeset/`
   which you commit. `patch` is for bug fixes only; new API surface is
   `minor`. See [`.changeset/README.md`](.changeset/README.md).
2. **Release.** From an up-to-date, clean `main`, run `npm run publish`.
   It builds and tests first, then applies the pending changesets (bumping the
   versions and writing the `CHANGELOG.md`s), regenerates the oclif command
   reference in the READMEs of the packages that moved, publishes to npm, and
   only then tags each of them `name@X.Y.Z`, pushes, and publishes one GitHub
   release per tag — its notes are the changelog entries changesets just wrote.

If a release is interrupted, **do not undo anything**: run `npm run publish`
again. It detects that some package is still missing from the registry and
resumes the publish instead of starting a new release.

`npm run publish-next` does the same under the `next` dist-tag, leaving
`latest` untouched; its GitHub releases are marked as prereleases, so they
don't become the repository's "Latest release" either.

Releases up to v4.0.29 carried a single `vX.Y.Z` tag covering the whole repo.
Those tags stay where they are; new ones are per package, which is also what the
source links in the generated command reference now point at.

<!--datocms-autoinclude-footer start-->

---

# What is DatoCMS?

<a href="https://www.datocms.com/"><img src="https://www.datocms.com/images/full_logo.svg" height="60" alt="DatoCMS - The Headless CMS for the Modern Web"></a>

[DatoCMS](https://www.datocms.com/) is Headless CMS for the modern web. Trusted by 25,000+ businesses, agencies, and individuals, it gives your team one place to manage content and ship it to any website, app, or device via API.

**New here?** Start with [Create free account](https://dashboard.datocms.com/signup) and the [Documentation](https://www.datocms.com/docs). Stuck? Ask the [Community](https://community.datocms.com/). Curious what's new? [Product Updates](https://www.datocms.com/product-updates).

**Building with AI:** [Agent Skills](https://www.datocms.com/docs/agent-skills) turn coding assistants (Claude Code, Cursor) into expert DatoCMS developers, with full read/write via the auto-installed CLI. No local terminal? Use the [MCP Server](https://www.datocms.com/docs/mcp-server) instead.

**Talking to DatoCMS from code:**
- [Content Delivery API](https://www.datocms.com/docs/content-delivery-api) (CDA) — the fast, read-only GraphQL API your website/app uses to **fetch** published content.
- [Content Management API](https://www.datocms.com/docs/content-management-api) (CMA) — the REST API for **creating and updating** content, models, and project settings (think scripts, migrations, integrations).
- [CLI](https://www.datocms.com/docs/scripting-migrations/installing-the-cli) — terminal tool for schema migrations and importing from Contentful/WordPress.

**Framework guides:** end-to-end recipes for fetching content, rendering Structured Text, optimizing images/video, handling SEO, and setting up live preview with visual editing in [Next.js](https://www.datocms.com/docs/next-js), [Nuxt](https://www.datocms.com/docs/nuxt), [Svelte](https://www.datocms.com/docs/svelte), and [Astro](https://www.datocms.com/docs/astro).

**Want a head start?** Browse our [starter projects](https://www.datocms.com/marketplace/starters) — ready-to-deploy example sites for popular frameworks.


<!--datocms-autoinclude-footer end-->

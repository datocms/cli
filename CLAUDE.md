# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the DatoCMS CLI - a monorepo containing CLI tools for managing DatoCMS projects, environments, and schemas. It includes:

- `datocms` (`packages/cli/`): Main CLI package with environment management, migrations, and maintenance commands
- `@datocms/cli` (`packages/cli-legacy/`): Legacy scoped alias that just depends on `datocms`
- `@datocms/cli-plugin-wordpress`: WordPress import functionality
- `@datocms/cli-plugin-contentful`: Contentful import functionality
- `@datocms/cli-utils`: Shared utilities and base commands

## Architecture

The packages live under `packages/` and are **npm workspaces**. **Turborepo** runs the builds, deriving the order from the dependencies between packages, and **Changesets** handles versioning and the changelogs.

### Key Components

**CLI Core (`packages/cli/`)**:
- Built on oclif framework for CLI command structure
- Commands organized by topic: `environments`, `migrations`, `maintenance`, `profile`
- Uses `environments-diff` utility for schema synchronization between environments
- Migration system with timestamped files in `migrations/` directory

**Plugin Architecture**:
- WordPress and Contentful plugins extend base functionality
- Both plugins follow similar patterns with step-based imports and validation
- Base command classes in `cli-utils` provide shared functionality

**Common Patterns**:
- All packages use TypeScript with strict configuration
- Commands extend base classes from `@datocms/cli-utils`
- API interactions through DatoCMS REST clients
- Step-based processing for complex operations (imports, migrations)

## Development Commands

```bash
# Initial setup
npm install
npm run build

# Development workflow
npm run format     # Format and fix code with Biome
npm run lint       # Check code quality with Biome
npm run build      # Build all packages, in dependency order, via Turborepo
npm run test       # Run every package's tests via Turborepo

# Releasing
npx changeset        # Describe a change, in the PR that makes it
npm run publish      # Build, test, version, publish, tag, release notes
npm run publish-next # The same, under the `next` dist-tag
```

Changes worth mentioning in a release need a changeset committed alongside them
(`npx changeset`); see `.changeset/README.md`. Note that `changeset version`
runs no npm lifecycle hooks, so anything that used to hang off one — the
`oclif readme` regeneration, in particular — lives in `toolchain/publish.mjs`.

### Individual Package Commands

Each package supports:
```bash
cd packages/cli
npm run build    # TypeScript compilation
npm run test     # Mocha tests
npm run prepack  # Build + generate oclif manifest
```

## Testing

- Uses **Mocha** with TypeScript support via `ts-node`
- Test files follow pattern `test/**/*.test.ts`
- Each package manages its own tests; `npm test` at the root runs them
  through Turborepo, after building what they depend on
- The WordPress and Contentful import suites talk to live APIs and create real
  DatoCMS projects, which they delete afterwards. They need a `.env` at the root
  (see `.env.sample`) and, for WordPress, `docker compose up` in its package.
  `npm test` runs them, and so does `npm run publish` — a release cannot be cut
  without that setup. Each prerequisite is checked in a `before` hook that says
  what is missing and how to fix it, so a misconfiguration fails as itself
  rather than as a 401 halfway through an import
- `packages/cli`'s suite needs nothing

## Code Quality

- **Biome** for linting and formatting (configured in `biome.json`)
- **Husky** + **lint-staged** for pre-commit hooks
- TypeScript strict mode enabled
- Uses single quotes, space indentation
- Ignores generated `lib/` directories

## Migration System

The CLI includes a migration system (`packages/cli/migrations/`) for schema changes:
- Timestamped migration files (format: `TIMESTAMP_description.ts`)
- Use `datocms migrations:new` to create new migrations
- Use `datocms migrations:run` to execute pending migrations
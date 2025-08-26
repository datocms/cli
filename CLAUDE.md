# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the DatoCMS CLI - a monorepo containing CLI tools for managing DatoCMS projects, environments, and schemas. It includes:

- `@datocms/cli`: Main CLI package with environment management, migrations, and maintenance commands
- `@datocms/cli-plugin-wordpress`: WordPress import functionality  
- `@datocms/cli-plugin-contentful`: Contentful import functionality
- `@datocms/cli-utils`: Shared utilities and base commands

## Architecture

The codebase uses **Lerna** for monorepo management with packages organized under `packages/`. Each package is built independently using TypeScript.

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
lerna bootstrap  
npm run build

# Development workflow
npm run format     # Format and fix code with Biome
npm run lint       # Check code quality with Biome
npm run build      # Build all packages with Lerna
npm run test       # Run tests (individual packages)

# Publishing
npm run publish      # Test, build, and publish to npm
npm run publish-next # Publish with next tag
```

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
- Individual packages run tests independently
- No unified test runner - each package manages its own tests

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
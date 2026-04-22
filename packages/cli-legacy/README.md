# @datocms/cli

Legacy scoped alias for [`datocms`](https://www.npmjs.com/package/datocms). This package exists so that existing installs and code importing `@datocms/cli` keep working after the package was renamed to the unscoped `datocms` name.

**New projects should install `datocms` directly:**

```bash
npm install -g datocms
```

## How it works

Installing `@datocms/cli` pulls in `datocms` as a dependency and re-exports its binary and programmatic API. The binary, commands, plugins, and on-disk config (`~/.config/datocms/...`) are identical — both packages release in lockstep.

Programmatic imports keep working:

```ts
import type { Client } from '@datocms/cli/lib/cma-client-node';
// ...is re-exported from:
import type { Client } from 'datocms/lib/cma-client-node';
```

## Migrating to `datocms`

If you previously installed this package globally, switch to the unscoped name to avoid two copies fighting over the `datocms` binary:

```bash
npm uninstall -g @datocms/cli
npm install -g datocms
```

User-installed plugins and saved profiles are preserved across the switch (they live under `~/.config/datocms`).

# datocms

Unscoped alias for [`@datocms/cli`](https://www.npmjs.com/package/@datocms/cli). Installing this package installs the DatoCMS CLI under the shorter `datocms` name.

```bash
npm install -g datocms
datocms --help
```

The binary, commands, plugins, and on-disk config (`~/.config/datocms/...`) are identical to `@datocms/cli`. Both packages are released in lockstep — this one just re-exports the other.

## Migrating from `@datocms/cli`

If you previously installed the scoped package globally, uninstall it first to avoid two copies fighting over the `datocms` binary:

```bash
npm uninstall -g @datocms/cli
npm install -g datocms
```

User-installed plugins and saved profiles are preserved across the switch.

## Documentation

See the [`@datocms/cli` README](https://github.com/datocms/cli/tree/main/packages/cli) for the full command reference.

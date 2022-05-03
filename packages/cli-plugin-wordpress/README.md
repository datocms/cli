# DatoCMS WordPress Import CLI

DatoCMS CLI plugin to import a WordPress site into a DatoCMS project.

<!-- toc -->

- [DatoCMS WordPress Import CLI](#datocms-wordpress-import-cli)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

<br /><br />
<a href="https://www.datocms.com/">
<img src="https://www.datocms.com/images/full_logo.svg" height="60">
</a>
<br /><br />

# Usage

```sh-session
$ npm install -g @datocms/cli
$ datocms plugins:install @datocms/cli-plugin-wordpress
$ datocms wordpress:import --help
```

# Commands

<!-- commands -->

- [`@datocms/cli-plugin-wordpress wordpress:import`](#datocmscli-plugin-wordpress-wordpressimport)

## `@datocms/cli-plugin-wordpress wordpress:import`

Imports a WordPress site into a DatoCMS project

```
USAGE
  $ @datocms/cli-plugin-wordpress wordpress:import [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Imports a WordPress site into a DatoCMS project
```

_See code: [lib/commands/wordpress/import.js](https://github.com/datocms/cli/blob/v0.1.8/packages/cli-plugin-wordpress/lib/commands/wordpress/import.js)_

<!-- commandsstop -->

# Development

Tests require a working WordPress instance with specific data in it, and will import content in a newly created DatoCMS project.

You can launch the WP instance with:

```
docker-compose up
```

You can then run tests with:

```
npm run test
```

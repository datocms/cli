# DatoCMS WordPress Import CLI

DatoCMS CLI plugin to import a WordPress site into a DatoCMS project.

<!-- toc -->
* [DatoCMS WordPress Import CLI](#datocms-wordpress-import-cli)
* [Usage](#usage)
* [Commands](#commands)
* [Development](#development)
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
* [`@datocms/cli-plugin-wordpress wordpress:import`](#datocmscli-plugin-wordpress-wordpressimport)

## `@datocms/cli-plugin-wordpress wordpress:import`

Imports a WordPress site into a DatoCMS project

```
USAGE
  $ @datocms/cli-plugin-wordpress wordpress:import --wp-username <value> --wp-password <value> [--json] [--config-file
    <value>] [--profile <value>] [--api-token <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--wp-json-api-url
    <value> | --wp-url <value>] [--autoconfirm] [--ignore-errors] [--concurrency <value>]

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --autoconfirm                                   Automatically enters the affirmative response to all confirmation
                                                  prompts, enabling the command to execute without waiting for user
                                                  confirmation. Forces the destroy of existing "wp_*" models.
  --concurrency=<value>                           [default: 15] Maximum number of operations to be run concurrently
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --ignore-errors                                 Try to ignore errors encountered during import
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js
  --wp-json-api-url=<value>                       The endpoint for your WordPress install (ex.
                                                  https://www.wordpress-website.com/wp-json)
  --wp-password=<value>                           (required) WordPress password
  --wp-url=<value>                                A URL within a WordPress REST API-enabled site (ex.
                                                  https://www.wordpress-website.com)
  --wp-username=<value>                           (required) WordPress username

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Imports a WordPress site into a DatoCMS project
```

_See code: [lib/commands/wordpress/import.js](https://github.com/datocms/cli/blob/v1.2.0/packages/cli-plugin-wordpress/lib/commands/wordpress/import.js)_
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

To save a new dump:

```
docker-compose exec db mysqldump -uwordpress -pwordpress wordpress > wp_test_data/mysql/dump.sql
```

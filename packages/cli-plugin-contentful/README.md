# DatoCMS Contentful Import CLI

DatoCMS CLI plugin to import a Contentful project into a DatoCMS project.

<!-- toc -->

- [DatoCMS Contentful Import CLI](#datocms-contentful-import-cli)
- [Usage](#usage)
- [Commands](#commands)
- [Test](#test)
<!-- tocstop -->

<br /><br />
<a href="https://www.datocms.com/">
<img src="https://www.datocms.com/images/full_logo.svg" height="60">
</a>
<br /><br />

# Usage

```sh-session
$ npm install -g @datocms/cli
$ datocms plugins:install @datocms/cli-plugin-contentful
$ datocms contentful:import --help
```

# Commands

<!-- commands -->

- [`@datocms/cli-plugin-contentful contentful:import`](#datocmscli-plugin-contentful-contentfulimport)

## `@datocms/cli-plugin-contentful contentful:import`

Imports a Contentful project into a DatoCMS project

```
USAGE
  $ @datocms/cli-plugin-contentful contentful:import --contentful-token <value> --contentful-space-id <value> --contentful-environment <value>
    --skip-content [--only-content-type <value>] [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS]
    [--autoconfirm] [--ignore-errors] [--concurrency <value>]

FLAGS
  --contentful-token=<value>                      (required) Contentful content management token
  --contentful-space-id=<value>                   (required) The ID of the Contentful space you want to import
  --contentful-environment=<value>                The ID of the Contentful environment you want to import, default is main
  --api-token=<value>                             (required) Specify a custom API key to access a DatoCMS project
  --autoconfirm                                   Automatically enters the affirmative response to all confirmation
                                                  prompts, enabling the command to execute without waiting for user
                                                  confirmation. Forces the destroy of models with the same API keys as the
                                                  ones you want to import.
  --skip-content                                  Use this flag to copy only the schema of the project - content types and fields
  --only-content-type                             Exclusively import the specified content types, using comma separated
                                                  Contentful IDs - Example: blogPost,author
  --ignore-errors                                 Try to ignore errors encountered during import
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js
  --concurrency=<value>                           [default: 15] Maximum number of operations to be run concurrently
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path

GLOBAL FLAGS
  --json Format output as json.

DESCRIPTION
  Imports a Contentful project into a DatoCMS project
```

_See code: [lib/commands/contentful/import.js](https://github.com/datocms/cli/blob/v1.0.0/packages/cli-plugin-contentful/lib/commands/contentful/import.js)_

<!-- commandsstop -->

# Test

Unfortunately Contentful management client only accepts read-write tokens, so we cannot make testing available for everybody.

To run the tests use this command:

```
CONTENTFUL_TOKEN=xxx npm run test
```

You can get the `CONTENTFUL_TOKEN` from the password management service

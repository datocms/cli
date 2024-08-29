# DatoCMS Contentful Import CLI

DatoCMS CLI plugin to import a Contentful project into a DatoCMS project.
Read a more detailed documentation [on the website](https://www.datocms.com/docs/import-and-export/import-space-from-contentful)

<!-- toc -->
* [DatoCMS Contentful Import CLI](#datocms-contentful-import-cli)
* [Usage](#usage)
* [Commands](#commands)
* [Test](#test)
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
* [`@datocms/cli-plugin-contentful contentful:import`](#datocmscli-plugin-contentful-contentfulimport)

## `@datocms/cli-plugin-contentful contentful:import`

Import a Contentful project into a DatoCMS project

```
USAGE
  $ @datocms/cli-plugin-contentful contentful:import [--json] [--config-file <value>] [--profile <value>] [--api-token
    <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory] [--contentful-token
    <value>] [--contentful-space-id <value>] [--contentful-environment <value>] [--autoconfirm] [--ignore-errors]
    [--skip-content] [--only-content-type <value>] [--concurrency <value>]

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --autoconfirm                                   Automatically enter an affirmative response to all confirmation
                                                  prompts, enabling the command to execute without waiting for user
                                                  confirmation, like forcing the destroy of existing Contentful schema
                                                  models.
  --concurrency=<value>                           [default: 15] Specify the maximum number of operations to be run
                                                  concurrently
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --contentful-environment=<value>                The environment you want to work with
  --contentful-space-id=<value>                   Your Contentful project space ID
  --contentful-token=<value>                      Your Contentful project read-only API token
  --ignore-errors                                 Ignore errors encountered during import
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --log-mode=(stdout|file|directory)              Where logged output should be written to
  --only-content-type=<value>                     Exclusively import the specified content types. Specify the content
                                                  types you want to import with comma separated Contentful IDs -
                                                  Example: blogPost,landingPage,author
  --profile=<value>                               Use settings of profile in datocms.config.js
  --skip-content                                  Exclusively import the schema (models) and ignore records and assets

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Import a Contentful project into a DatoCMS project
```

_See code: [lib/commands/contentful/import.js](https://github.com/datocms/cli/blob/v2.0.8/packages/cli-plugin-contentful/lib/commands/contentful/import.js)_
<!-- commandsstop -->

# Test

Unfortunately Contentful management client only accepts read-write tokens, so we cannot make testing available for everybody.

To run the tests use this command:

```
CONTENTFUL_TOKEN=xxx npm run test
```

You can get the `CONTENTFUL_TOKEN` from the password management service

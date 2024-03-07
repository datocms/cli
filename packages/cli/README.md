# DatoCMS CLI

DatoCMS CLI tool for managing DatoCMS projects, environments and schemas.

<!-- toc -->
* [DatoCMS CLI](#datocms-cli)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

<br /><br />
<a href="https://www.datocms.com/">
<img src="https://www.datocms.com/images/full_logo.svg" height="60">
</a>
<br /><br />

# Usage

```sh-session
$ npm install -g @datocms/cli

$ datocms COMMAND
running command...

$ datocms (--version)
@datocms/cli/0.1.6 darwin-x64 node-v16.20.0

$ datocms --help [COMMAND]
USAGE
  $ datocms COMMAND
...
```

# Commands

<!-- commands -->
* [`datocms autocomplete [SHELL]`](#datocms-autocomplete-shell)
* [`datocms environments:destroy ENVIRONMENT_ID`](#datocms-environmentsdestroy-environment_id)
* [`datocms environments:fork SOURCE_ENVIRONMENT_ID NEW_ENVIRONMENT_ID`](#datocms-environmentsfork-source_environment_id-new_environment_id)
* [`datocms environments:index`](#datocms-environmentsindex)
* [`datocms environments:list`](#datocms-environmentslist)
* [`datocms environments:primary`](#datocms-environmentsprimary)
* [`datocms environments:promote ENVIRONMENT_ID`](#datocms-environmentspromote-environment_id)
* [`datocms help [COMMAND]`](#datocms-help-command)
* [`datocms maintenance:off`](#datocms-maintenanceoff)
* [`datocms maintenance:on`](#datocms-maintenanceon)
* [`datocms migrations:new NAME`](#datocms-migrationsnew-name)
* [`datocms migrations:run`](#datocms-migrationsrun)
* [`datocms plugins`](#datocms-plugins)
* [`datocms plugins:install PLUGIN...`](#datocms-pluginsinstall-plugin)
* [`datocms plugins:available`](#datocms-pluginsavailable)
* [`datocms plugins:inspect PLUGIN...`](#datocms-pluginsinspect-plugin)
* [`datocms plugins:install PLUGIN...`](#datocms-pluginsinstall-plugin-1)
* [`datocms plugins:link PLUGIN`](#datocms-pluginslink-plugin)
* [`datocms plugins:uninstall PLUGIN...`](#datocms-pluginsuninstall-plugin)
* [`datocms plugins:uninstall PLUGIN...`](#datocms-pluginsuninstall-plugin-1)
* [`datocms plugins:uninstall PLUGIN...`](#datocms-pluginsuninstall-plugin-2)
* [`datocms plugins:update`](#datocms-pluginsupdate)
* [`datocms profile:remove PROFILE_ID`](#datocms-profileremove-profile_id)
* [`datocms profile:set PROFILE_ID`](#datocms-profileset-profile_id)

## `datocms autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ datocms autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  display autocomplete installation instructions

EXAMPLES
  $ datocms autocomplete

  $ datocms autocomplete bash

  $ datocms autocomplete zsh

  $ datocms autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v1.2.0/src/commands/autocomplete/index.ts)_

## `datocms environments:destroy ENVIRONMENT_ID`

Destroys a sandbox environment

```
USAGE
  $ datocms environments:destroy [ENVIRONMENT_ID] [--json] [--config-file <value>] [--profile <value>] [--api-token
    <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS]

ARGUMENTS
  ENVIRONMENT_ID  The environment to destroy

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Destroys a sandbox environment
```

_See code: [lib/commands/environments/destroy.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/environments/destroy.js)_

## `datocms environments:fork SOURCE_ENVIRONMENT_ID NEW_ENVIRONMENT_ID`

Creates a new sandbox environment by forking an existing one

```
USAGE
  $ datocms environments:fork [SOURCE_ENVIRONMENT_ID] [NEW_ENVIRONMENT_ID] [--json] [--config-file <value>] [--profile
    <value>] [--api-token <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--force --fast]

ARGUMENTS
  SOURCE_ENVIRONMENT_ID  The environment to copy
  NEW_ENVIRONMENT_ID     The name of the new sandbox environment to generate

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --fast                                          Run a fast fork. A fast fork reduces processing time, but it also
                                                  prevents writing to the source environment during the process
  --force                                         Forces the start of a fast fork, even there are users currently
                                                  editing records in the environment to copy
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Creates a new sandbox environment by forking an existing one
```

_See code: [lib/commands/environments/fork.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/environments/fork.js)_

## `datocms environments:index`

Lists primary/sandbox environments of a project

```
USAGE
  $ datocms environments:index [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output
    csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]

FLAGS
  -x, --extended                                  show extra columns
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --columns=<value>                               only show provided columns (comma-separated)
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --csv                                           output is csv format [alias: --output=csv]
  --filter=<value>                                filter property by partial string matching, ex: name=foo
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --no-header                                     hide table header from output
  --no-truncate                                   do not truncate output to fit screen
  --output=<option>                               output in a more machine friendly format
                                                  <options: csv|json|yaml>
  --profile=<value>                               Use settings of profile in datocms.config.js
  --sort=<value>                                  property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Lists primary/sandbox environments of a project

ALIASES
  $ datocms environments:index
  $ datocms environments:list
```

## `datocms environments:list`

Lists primary/sandbox environments of a project

```
USAGE
  $ datocms environments:list [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output
    csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]

FLAGS
  -x, --extended                                  show extra columns
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --columns=<value>                               only show provided columns (comma-separated)
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --csv                                           output is csv format [alias: --output=csv]
  --filter=<value>                                filter property by partial string matching, ex: name=foo
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --no-header                                     hide table header from output
  --no-truncate                                   do not truncate output to fit screen
  --output=<option>                               output in a more machine friendly format
                                                  <options: csv|json|yaml>
  --profile=<value>                               Use settings of profile in datocms.config.js
  --sort=<value>                                  property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Lists primary/sandbox environments of a project

ALIASES
  $ datocms environments:index
  $ datocms environments:list
```

_See code: [lib/commands/environments/list.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/environments/list.js)_

## `datocms environments:primary`

Returns the name the primary environment of a project

```
USAGE
  $ datocms environments:primary [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS]

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Returns the name the primary environment of a project
```

_See code: [lib/commands/environments/primary.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/environments/primary.js)_

## `datocms environments:promote ENVIRONMENT_ID`

Promotes a sandbox environment to primary

```
USAGE
  $ datocms environments:promote [ENVIRONMENT_ID] [--json] [--config-file <value>] [--profile <value>] [--api-token
    <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS]

ARGUMENTS
  ENVIRONMENT_ID  The environment to promote

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Promotes a sandbox environment to primary
```

_See code: [lib/commands/environments/promote.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/environments/promote.js)_

## `datocms help [COMMAND]`

Display help for datocms.

```
USAGE
  $ datocms help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for datocms.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.12/src/commands/help.ts)_

## `datocms maintenance:off`

Take a project out of maintenance mode

```
USAGE
  $ datocms maintenance:off [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS]

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Take a project out of maintenance mode
```

_See code: [lib/commands/maintenance/off.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/maintenance/off.js)_

## `datocms maintenance:on`

Put a project in maintenance mode

```
USAGE
  $ datocms maintenance:on [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--force]

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --force                                         Forces the activation of maintenance mode even there are users
                                                  currently editing records
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --profile=<value>                               Use settings of profile in datocms.config.js

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Put a project in maintenance mode
```

_See code: [lib/commands/maintenance/on.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/maintenance/on.js)_

## `datocms migrations:new NAME`

Create a new migration script

```
USAGE
  $ datocms migrations:new [NAME] [--json] [--config-file <value>] [--profile <value>] [--api-token <value>]
    [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--ts | --js] [--template <value> | --autogenerate <value>]

ARGUMENTS
  NAME  The name to give to the script

FLAGS
  --api-token=<value>
      Specify a custom API key to access a DatoCMS project

  --autogenerate=<value>
      Auto-generates script by diffing the schema of two environments

      Examples:
      * --autogenerate=foo finds changes made to sandbox environment 'foo' and applies them to primary environment
      * --autogenerate=foo:bar finds changes made to environment 'foo' and applies them to environment 'bar'

  --config-file=<value>
      [default: ./datocms.config.json] Specify a custom config file path

  --js
      Forces the creation of a JavaScript migration file

  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)
      Level of logging for performed API calls

  --profile=<value>
      Use settings of profile in datocms.config.js

  --template=<value>
      Start the migration script from a custom template

  --ts
      Forces the creation of a TypeScript migration file

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Create a new migration script
```

_See code: [lib/commands/migrations/new.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/migrations/new.js)_

## `datocms migrations:run`

Run migration scripts that have not run yet

```
USAGE
  $ datocms migrations:run [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--source <value>] [--dry-run] [--force [--fast-fork [--destination <value> |
    --in-place]]] [--migrations-dir <value>] [--migrations-model <value>] [--migrations-tsconfig <value>]

FLAGS
  --api-token=<value>                             Specify a custom API key to access a DatoCMS project
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --destination=<value>                           Specify the name of the new forked environment
  --dry-run                                       Simulate the execution of the migrations, without making any actual
                                                  change
  --fast-fork                                     Run a fast fork. A fast fork reduces processing time, but it also
                                                  prevents writing to the source environment during the process
  --force                                         Forces the start of a fast fork, even there are users currently
                                                  editing records in the environment to copy
  --in-place                                      Run the migrations in the --source environment, without forking
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging for performed API calls
  --migrations-dir=<value>                        Directory where script migrations are stored
  --migrations-model=<value>                      API key of the DatoCMS model used to store migration data
  --migrations-tsconfig=<value>                   Path of the tsconfig.json to use to run TS migrations scripts
  --profile=<value>                               Use settings of profile in datocms.config.js
  --source=<value>                                Specify the environment to fork

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Run migration scripts that have not run yet
```

_See code: [lib/commands/migrations/run.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/migrations/run.js)_

## `datocms plugins`

List installed plugins.

```
USAGE
  $ datocms plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ datocms plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/index.ts)_

## `datocms plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ datocms plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ datocms plugins:add

EXAMPLES
  $ datocms plugins:install myplugin 

  $ datocms plugins:install https://github.com/someuser/someplugin

  $ datocms plugins:install someuser/someplugin
```

## `datocms plugins:available`

Lists official DatoCMS CLI plugins

```
USAGE
  $ datocms plugins:available [--json] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output
    csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]

FLAGS
  -x, --extended     show extra columns
  --columns=<value>  only show provided columns (comma-separated)
  --csv              output is csv format [alias: --output=csv]
  --filter=<value>   filter property by partial string matching, ex: name=foo
  --no-header        hide table header from output
  --no-truncate      do not truncate output to fit screen
  --output=<option>  output in a more machine friendly format
                     <options: csv|json|yaml>
  --sort=<value>     property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Lists official DatoCMS CLI plugins
```

_See code: [lib/commands/plugins/available.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/plugins/available.js)_

## `datocms plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ datocms plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ datocms plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/inspect.ts)_

## `datocms plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ datocms plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ datocms plugins:add

EXAMPLES
  $ datocms plugins:install myplugin 

  $ datocms plugins:install https://github.com/someuser/someplugin

  $ datocms plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/install.ts)_

## `datocms plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ datocms plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.

EXAMPLES
  $ datocms plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/link.ts)_

## `datocms plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ datocms plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ datocms plugins:unlink
  $ datocms plugins:remove
```

## `datocms plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ datocms plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ datocms plugins:unlink
  $ datocms plugins:remove
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/uninstall.ts)_

## `datocms plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ datocms plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ datocms plugins:unlink
  $ datocms plugins:remove
```

## `datocms plugins:update`

Update installed plugins.

```
USAGE
  $ datocms plugins:update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/update.ts)_

## `datocms profile:remove PROFILE_ID`

Remove a profile from DatoCMS config file

```
USAGE
  $ datocms profile:remove [PROFILE_ID] [--json] [--config-file <value>]

ARGUMENTS
  PROFILE_ID  The name of the profile

FLAGS
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Remove a profile from DatoCMS config file
```

_See code: [lib/commands/profile/remove.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/profile/remove.js)_

## `datocms profile:set PROFILE_ID`

Add/update profile configuration in DatoCMS config file

```
USAGE
  $ datocms profile:set [PROFILE_ID] [--json] [--config-file <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--migrations-dir <value>] [--migrations-model <value>] [--migrations-template
    <value>] [--migrations-tsconfig <value>]

ARGUMENTS
  PROFILE_ID  [default: default] Name of the profile to create/update

FLAGS
  --config-file=<value>                           [default: ./datocms.config.json] Specify a custom config file path
  --log-level=(NONE|BASIC|BODY|BODY_AND_HEADERS)  Level of logging to use for the profile
  --migrations-dir=<value>                        Directory where script migrations will be stored
  --migrations-model=<value>                      API key of the DatoCMS model used to store migration data
  --migrations-template=<value>                   Path of the file to use as migration script template
  --migrations-tsconfig=<value>                   Path of the tsconfig.json to use to run TS migration scripts

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Add/update profile configuration in DatoCMS config file
```

_See code: [lib/commands/profile/set.js](https://github.com/datocms/cli/blob/v2.0.0-alpha.0/packages/cli/lib/commands/profile/set.js)_
<!-- commandsstop -->

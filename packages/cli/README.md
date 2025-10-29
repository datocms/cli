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
* [`datocms environments:rename ENVIRONMENT_ID NEW_ENVIRONMENT_ID`](#datocms-environmentsrename-environment_id-new_environment_id)
* [`datocms help [COMMAND]`](#datocms-help-command)
* [`datocms maintenance:off`](#datocms-maintenanceoff)
* [`datocms maintenance:on`](#datocms-maintenanceon)
* [`datocms migrations:new NAME`](#datocms-migrationsnew-name)
* [`datocms migrations:run`](#datocms-migrationsrun)
* [`datocms plugins`](#datocms-plugins)
* [`datocms plugins:add PLUGIN`](#datocms-pluginsadd-plugin)
* [`datocms plugins:available`](#datocms-pluginsavailable)
* [`datocms plugins:inspect PLUGIN...`](#datocms-pluginsinspect-plugin)
* [`datocms plugins:install PLUGIN`](#datocms-pluginsinstall-plugin)
* [`datocms plugins:link PATH`](#datocms-pluginslink-path)
* [`datocms plugins:remove [PLUGIN]`](#datocms-pluginsremove-plugin)
* [`datocms plugins:reset`](#datocms-pluginsreset)
* [`datocms plugins:uninstall [PLUGIN]`](#datocms-pluginsuninstall-plugin)
* [`datocms plugins:unlink [PLUGIN]`](#datocms-pluginsunlink-plugin)
* [`datocms plugins:update`](#datocms-pluginsupdate)
* [`datocms profile:remove PROFILE_ID`](#datocms-profileremove-profile_id)
* [`datocms profile:set PROFILE_ID`](#datocms-profileset-profile_id)
* [`datocms schema:generate FILENAME`](#datocms-schemagenerate-filename)

## `datocms autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ datocms autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ datocms autocomplete

  $ datocms autocomplete bash

  $ datocms autocomplete zsh

  $ datocms autocomplete powershell

  $ datocms autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.2.34/src/commands/autocomplete/index.ts)_

## `datocms environments:destroy ENVIRONMENT_ID`

Destroys a sandbox environment

```
USAGE
  $ datocms environments:destroy ENVIRONMENT_ID [--json] [--config-file <value>] [--profile <value>] [--api-token <value>]
    [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]

ARGUMENTS
  ENVIRONMENT_ID  The environment to destroy

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Destroys a sandbox environment
```

_See code: [src/commands/environments/destroy.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/environments/destroy.ts)_

## `datocms environments:fork SOURCE_ENVIRONMENT_ID NEW_ENVIRONMENT_ID`

Creates a new sandbox environment by forking an existing one

```
USAGE
  $ datocms environments:fork SOURCE_ENVIRONMENT_ID NEW_ENVIRONMENT_ID [--json] [--config-file <value>] [--profile
    <value>] [--api-token <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]
    [--force --fast]

ARGUMENTS
  SOURCE_ENVIRONMENT_ID  The environment to copy
  NEW_ENVIRONMENT_ID     The name of the new sandbox environment to generate

FLAGS
  --fast   Run a fast fork. A fast fork reduces processing time, but it also prevents writing to the source environment
           during the process
  --force  Forces the start of a fast fork, even there are users currently editing records in the environment to copy

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Creates a new sandbox environment by forking an existing one
```

_See code: [src/commands/environments/fork.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/environments/fork.ts)_

## `datocms environments:index`

Lists primary/sandbox environments of a project

```
USAGE
  $ datocms environments:index [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

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
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Lists primary/sandbox environments of a project

ALIASES
  $ datocms environments:index
  $ datocms environments:list
```

_See code: [src/commands/environments/list.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/environments/list.ts)_

## `datocms environments:primary`

Returns the name the primary environment of a project

```
USAGE
  $ datocms environments:primary [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Returns the name the primary environment of a project
```

_See code: [src/commands/environments/primary.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/environments/primary.ts)_

## `datocms environments:promote ENVIRONMENT_ID`

Promotes a sandbox environment to primary

```
USAGE
  $ datocms environments:promote ENVIRONMENT_ID [--json] [--config-file <value>] [--profile <value>] [--api-token <value>]
    [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]

ARGUMENTS
  ENVIRONMENT_ID  The environment to promote

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Promotes a sandbox environment to primary
```

_See code: [src/commands/environments/promote.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/environments/promote.ts)_

## `datocms environments:rename ENVIRONMENT_ID NEW_ENVIRONMENT_ID`

Renames an environment

```
USAGE
  $ datocms environments:rename ENVIRONMENT_ID NEW_ENVIRONMENT_ID [--json] [--config-file <value>] [--profile <value>]
    [--api-token <value>] [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]

ARGUMENTS
  ENVIRONMENT_ID      The environment to rename
  NEW_ENVIRONMENT_ID  The new environment ID

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Renames an environment
```

_See code: [src/commands/environments/rename.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/environments/rename.ts)_

## `datocms help [COMMAND]`

Display help for datocms.

```
USAGE
  $ datocms help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for datocms.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.32/src/commands/help.ts)_

## `datocms maintenance:off`

Take a project out of maintenance mode

```
USAGE
  $ datocms maintenance:off [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory]

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Take a project out of maintenance mode
```

_See code: [src/commands/maintenance/off.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/maintenance/off.ts)_

## `datocms maintenance:on`

Put a project in maintenance mode

```
USAGE
  $ datocms maintenance:on [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory] [--force]

FLAGS
  --force  Forces the activation of maintenance mode even there are users currently editing records

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Put a project in maintenance mode
```

_See code: [src/commands/maintenance/on.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/maintenance/on.ts)_

## `datocms migrations:new NAME`

Create a new migration script

```
USAGE
  $ datocms migrations:new NAME [--json] [--config-file <value>] [--profile <value>] [--api-token <value>]
    [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory] [--ts | --js] [--template <value>
    | --autogenerate <value>] [--schema <value>]

ARGUMENTS
  NAME  The name to give to the script

FLAGS
  --autogenerate=<value>
      Auto-generates script by diffing the schema of two environments

      Examples:
      * --autogenerate=foo finds changes made to sandbox environment 'foo' and applies them to primary environment
      * --autogenerate=foo:bar finds changes made to environment 'foo' and applies them to environment 'bar'

  --js
      Forces the creation of a JavaScript migration file

  --schema=<value>
      Include schema definitions for models and blocks (TypeScript only). Use "all" for all item types, or specify
      comma-separated API keys for specific ones

  --template=<value>
      Start the migration script from a custom template

  --ts
      Forces the creation of a TypeScript migration file

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Create a new migration script
```

_See code: [src/commands/migrations/new.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/migrations/new.ts)_

## `datocms migrations:run`

Run migration scripts that have not run yet

```
USAGE
  $ datocms migrations:run [--json] [--config-file <value>] [--profile <value>] [--api-token <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory] [--source <value>] [--dry-run] [--force
    [--fast-fork [--destination <value> | --in-place]]] [--migrations-dir <value>] [--migrations-model <value>]
    [--migrations-tsconfig <value>]

FLAGS
  --destination=<value>          Specify the name of the new forked environment
  --dry-run                      Simulate the execution of the migrations, without making any actual change
  --fast-fork                    Run a fast fork. A fast fork reduces processing time, but it also prevents writing to
                                 the source environment during the process
  --force                        Forces the start of a fast fork, even there are users currently editing records in the
                                 environment to copy
  --in-place                     Run the migrations in the --source environment, without forking
  --migrations-dir=<value>       Directory where script migrations are stored
  --migrations-model=<value>     API key of the DatoCMS model used to store migration data
  --migrations-tsconfig=<value>  Path of the tsconfig.json to use to run TS migrations scripts
  --source=<value>               Specify the environment to fork

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Run migration scripts that have not run yet
```

_See code: [src/commands/migrations/run.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/migrations/run.ts)_

## `datocms plugins`

List installed plugins.

```
USAGE
  $ datocms plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ datocms plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/index.ts)_

## `datocms plugins:add PLUGIN`

Installs a plugin into datocms.

```
USAGE
  $ datocms plugins:add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into datocms.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the DATOCMS_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the DATOCMS_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ datocms plugins:add

EXAMPLES
  Install a plugin from npm registry.

    $ datocms plugins:add myplugin

  Install a plugin from a github url.

    $ datocms plugins:add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ datocms plugins:add someuser/someplugin
```

## `datocms plugins:available`

Lists official DatoCMS CLI plugins

```
USAGE
  $ datocms plugins:available [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Lists official DatoCMS CLI plugins
```

_See code: [src/commands/plugins/available.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/plugins/available.ts)_

## `datocms plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ datocms plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ datocms plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/inspect.ts)_

## `datocms plugins:install PLUGIN`

Installs a plugin into datocms.

```
USAGE
  $ datocms plugins:install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into datocms.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the DATOCMS_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the DATOCMS_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ datocms plugins:add

EXAMPLES
  Install a plugin from npm registry.

    $ datocms plugins:install myplugin

  Install a plugin from a github url.

    $ datocms plugins:install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ datocms plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/install.ts)_

## `datocms plugins:link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ datocms plugins:link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ datocms plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/link.ts)_

## `datocms plugins:remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ datocms plugins:remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ datocms plugins:unlink
  $ datocms plugins:remove

EXAMPLES
  $ datocms plugins:remove myplugin
```

## `datocms plugins:reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ datocms plugins:reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/reset.ts)_

## `datocms plugins:uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ datocms plugins:uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ datocms plugins:unlink
  $ datocms plugins:remove

EXAMPLES
  $ datocms plugins:uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/uninstall.ts)_

## `datocms plugins:unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ datocms plugins:unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ datocms plugins:unlink
  $ datocms plugins:remove

EXAMPLES
  $ datocms plugins:unlink myplugin
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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/update.ts)_

## `datocms profile:remove PROFILE_ID`

Remove a profile from DatoCMS config file

```
USAGE
  $ datocms profile:remove PROFILE_ID [--json] [--config-file <value>]

ARGUMENTS
  PROFILE_ID  The name of the profile

GLOBAL FLAGS
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.

DESCRIPTION
  Remove a profile from DatoCMS config file
```

_See code: [src/commands/profile/remove.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/profile/remove.ts)_

## `datocms profile:set PROFILE_ID`

Add/update profile configuration in DatoCMS config file

```
USAGE
  $ datocms profile:set PROFILE_ID [--json] [--config-file <value>] [--log-level
    NONE|BASIC|BODY|BODY_AND_HEADERS] [--migrations-dir <value>] [--migrations-model <value>] [--migrations-template
    <value>] [--migrations-tsconfig <value>]

ARGUMENTS
  PROFILE_ID  [default: default] Name of the profile to create/update

FLAGS
  --log-level=<option>           Level of logging to use for the profile
                                 <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --migrations-dir=<value>       Directory where script migrations will be stored
  --migrations-model=<value>     API key of the DatoCMS model used to store migration data
  --migrations-template=<value>  Path of the file to use as migration script template
  --migrations-tsconfig=<value>  Path of the tsconfig.json to use to run TS migration scripts

GLOBAL FLAGS
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.

DESCRIPTION
  Add/update profile configuration in DatoCMS config file
```

_See code: [src/commands/profile/set.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/profile/set.ts)_

## `datocms schema:generate FILENAME`

Generate TypeScript definitions for the schema

```
USAGE
  $ datocms schema:generate FILENAME [--json] [--config-file <value>] [--profile <value>] [--api-token <value>]
    [--log-level NONE|BASIC|BODY|BODY_AND_HEADERS] [--log-mode stdout|file|directory] [-e <value>] [-t <value>]

ARGUMENTS
  FILENAME  Output filename for the generated TypeScript definitions

FLAGS
  -e, --environment=<value>  Environment to generate schema from
  -t, --item-types=<value>   Comma-separated list of item type API keys to include (includes dependencies)

GLOBAL FLAGS
  --api-token=<value>    Specify a custom API key to access a DatoCMS project
  --config-file=<value>  [default: ./datocms.config.json] Specify a custom config file path
  --json                 Format output as json.
  --log-level=<option>   Level of logging for performed API calls
                         <options: NONE|BASIC|BODY|BODY_AND_HEADERS>
  --log-mode=<option>    Where logged output should be written to
                         <options: stdout|file|directory>
  --profile=<value>      Use settings of profile in datocms.config.js

DESCRIPTION
  Generate TypeScript definitions for the schema
```

_See code: [src/commands/schema/generate.ts](https://github.com/datocms/cli/blob/v3.1.6/packages/cli/src/commands/schema/generate.ts)_
<!-- commandsstop -->

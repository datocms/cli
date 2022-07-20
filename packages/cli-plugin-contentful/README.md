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

<!-- commandsstop -->

# Test

Unfortunately Contentful management client only accepts read-write tokens, so we cannot make testing available for everybody.

To run the tests use this command:

```
CONTENTFUL_TOKEN=xxx npm run test
```

You can get the `CONTENTFUL_TOKEN` from the password management service

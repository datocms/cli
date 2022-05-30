# DatoCMS WordPress Import CLI

DatoCMS CLI plugin to import a WordPress site into a DatoCMS project.

<!-- toc -->

- [DatoCMS WordPress Import CLI](#datocms-wordpress-import-cli)
- [Usage](#usage)
- [Commands](#commands)
- [Development](#development)
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

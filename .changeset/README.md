# Changesets

This folder holds the pending release notes for the next version.

Whenever you change something worth mentioning in a release, run `npx changeset`
and answer the two prompts (which packages, and whether it's a patch/minor/major).
That writes a small markdown file here, which you commit along with your changes.

At release time `npm run publish` consumes every pending file: it computes the
resulting versions, updates the `package.json`s and the `CHANGELOG.md`s, and
deletes the files.

## One version number, but only for what actually changed

The five packages are a `linked` group, which is exactly what `lerna publish`
did here: everything released together gets **the same** version number, and
whatever wasn't touched keeps the version it already had. That's why the repo
today has `datocms@4.0.29` next to `@datocms/cli-plugin-wordpress@4.0.25` — the
WordPress plugin simply hasn't changed since 4.0.25, and a CLI-only fix must not
republish it.

So the packages you tick in a changeset do matter here: they decide what gets
published. Changesets bumps their dependents for you (a change to
`@datocms/cli-utils` pulls in `datocms` and both import plugins), so tick the
package you actually edited and let it work the rest out.

The release is still tagged once, as `vX.Y.Z`, where `X.Y.Z` is the version the
released packages just landed on. The `oclif readme` links inside each package's
README point at that tag.

## Which bump level?

- `patch` — bug fixes only. It's the clearest signal in semver ("nothing new,
  just a fix"), so we don't spend it on anything else.
- `minor` — new API surface: a new command, a new flag, a new export from
  `@datocms/cli-utils`.
- `major` — a command, a flag or an export was removed or renamed.

## Prereleases

`npm run publish-next` publishes under the `next` dist-tag, leaving `latest`
untouched. It works in two modes:

- **as-is** — the pending changesets produce a normal version (say `4.1.0`)
  which is published under `next` instead of `latest`;
- **real prerelease versions** — run `npx changeset pre enter next` first and
  the same command produces `4.1.0-next.0`, `4.1.0-next.1`, … That mode is
  recorded in `.changeset/pre.json`, which you commit. Run
  `npx changeset pre exit` when the line is done.

Either way the GitHub release is marked as a prerelease, so it never becomes
the repository's "Latest release".

`npm run publish` refuses to run while `.changeset/pre.json` exists, so a
forgotten pre mode can't quietly turn a real release into a prerelease.

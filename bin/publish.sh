#!/usr/bin/env bash
#
# Releases the packages in this monorepo.
#
# The order of the steps below is the whole point: everything that can fail
# (network, tests, credentials) runs BEFORE anything irreversible happens, and
# the irreversible steps are ordered so that npm goes first and git follows.
#
# There is deliberately no rollback. `changeset publish` skips packages whose
# version is already on the registry, so if this script dies halfway through you
# recover by running it again: it notices that some package is still missing
# from npm and resumes the publish instead of starting a new release.

set -euo pipefail

cd "$(dirname "$0")/.."

DIST_TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag|--dist-tag) DIST_TAG="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mAborted: %s\033[0m\n' "$1" >&2; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Every publishable workspace package, as "name version location" triples.
#
# Read off the filesystem rather than asked of npm: `npm query` resolves
# workspace locations through node_modules, which during a release rehearsal is
# a symlink to another checkout, so it answers with paths outside the copy you
# are actually rehearsing.
packages() {
  node -e '
    const fs = require("node:fs"), path = require("node:path");
    for (const pattern of require("./package.json").workspaces) {
      const dir = path.dirname(pattern);
      for (const entry of fs.readdirSync(dir).sort()) {
        const location = path.join(dir, entry);
        let pkg;
        try { pkg = JSON.parse(fs.readFileSync(path.join(location, "package.json"), "utf8")); } catch { continue; }
        if (pkg.private) continue;
        console.log(pkg.name, pkg.version, location);
      }
    }
  '
}

# The version of the release, which is NOT the version of any one package.
#
# The packages are a `linked` group: a release moves the packages it touches to
# a common version and leaves the others where they were, so `datocms@4.0.29`
# sits next to `@datocms/cli-plugin-wordpress@4.0.25` today. Changesets derives
# that common version from the highest version in the group, so after the bump
# the highest version in the repo *is* the release — reading any single
# package's version would give the wrong answer for a release that didn't touch
# that package.
version() {
  packages | node -e '
    let input = "";
    process.stdin.on("data", (d) => (input += d)).on("end", () => {
      const versions = input.trim().split("\n").map((line) => line.split(" ")[1]);
      const key = (v) => v.split(/[.\-]/).map((n) => (/^\d+$/.test(n) ? n.padStart(10, "0") : n)).join(".");
      console.log(versions.sort((a, b) => (key(a) < key(b) ? 1 : -1))[0]);
    });
  '
}

# The packages that landed on the release version — i.e. the ones this release
# actually publishes. A `linked` group gives them all the same number, and that
# number is higher than anything left behind, so equality is the whole test.
released_packages() {
  local name ver loc
  while read -r name ver loc; do
    # An `if` rather than `[ ... ] && echo`: under `set -e` an AND-list that
    # ends false is the loop body's exit status, so a non-matching *last*
    # package would abort the whole script — right at the release notes, after
    # npm and git have already been written to.
    if [ "$ver" = "$1" ]; then
      echo "$name $ver $loc"
    fi
  done < <(packages)
}

pending_changesets() { find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' | wc -l | tr -d ' '; }

# The resume condition: at least one package whose local version is not yet on
# the registry. Checking a single package would be wrong — a release can die
# after publishing the first one.
unpublished() {
  local name ver loc missing=""
  while read -r name ver loc; do
    npm view "$name@$ver" version >/dev/null 2>&1 || missing="$missing $name@$ver"
  done < <(packages)
  echo "${missing# }"
}

# The section of a package's CHANGELOG for one version, without its "## x.y.z"
# heading — changesets has already written exactly the prose we want.
changelog_section() { # $1 = package location, $2 = version
  awk -v want="## $2" '$0 == want { found = 1; next } found && /^## / { exit } found' "$1/CHANGELOG.md"
}

# True when a changelog section says something a human wrote, as opposed to the
# dependency bookkeeping every package in a linked group accumulates:
#
#     - Updated dependencies [5b90e51]
#       - @datocms/cli-utils@4.0.30
#
# A bullet counts as prose unless it is exactly one of those lines.
has_prose() {
  grep -vE '^- Updated dependencies( \[[0-9a-f]+\])?$|^ *- [^ ]+@[0-9][^ ]*$' <<<"$1" | grep -qE '^- '
}

# The body of the GitHub release. One release covers every package that moved —
# but only the ones with something to say get a section, or the page fills up
# with each package restating that the others moved too. The footer keeps every
# published package visible.
release_notes() {
  local name ver loc section shipped=""
  while read -r name ver loc; do
    shipped="$shipped
- $name@$ver"
    section="$(changelog_section "$loc" "$VERSION")"
    has_prose "$section" || continue
    printf '## %s\n%s\n\n' "$name" "$section"
  done < <(released_packages "$VERSION")
  printf -- '---\n\nPublished in this release:%s\n' "$shipped"
}

# ---------------------------------------------------------------------------
# Preflight: no mutations, just refuse to start from a state we can't finish.
# ---------------------------------------------------------------------------
step "Preflight"

# Normal releases happen on main. Prereleases are routinely cut from a feature
# branch, so --tag only asks that the branch be clean and pushed.
if [ -z "$DIST_TAG" ]; then
  [ "$BRANCH" = "main" ] || fail "you are not on main. Use --tag to publish a prerelease from a branch."
  [ ! -f .changeset/pre.json ] || fail "the repo is in changesets pre mode (.changeset/pre.json).
  Run 'npx changeset pre exit' before cutting a real release."
fi

[ -z "$(git status --porcelain)" ] || fail "working tree is dirty. Commit or stash first."

git fetch --quiet origin "$BRANCH"
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] || \
  fail "$BRANCH and origin/$BRANCH have diverged. Pull (or push) first."

npm whoami >/dev/null 2>&1 || fail "you are not logged in to npm. Run 'npm login'."

command -v gh >/dev/null 2>&1 || fail "the GitHub CLI is not installed, so the release notes can't be published."
gh auth status >/dev/null 2>&1 || fail "you are not logged in to GitHub. Run 'gh auth login'."

echo "on $BRANCH, in sync with origin, npm user: $(npm whoami)"

# ---------------------------------------------------------------------------
# Decide between a fresh release and resuming an interrupted one.
# ---------------------------------------------------------------------------
if [ "$(pending_changesets)" -eq 0 ]; then
  MISSING="$(unpublished)"
  [ -n "$MISSING" ] || fail "no pending changesets: there is nothing to release.
  Describe your changes with 'npx changeset' first."
  step "Resuming the interrupted release of v$(version)"
  echo "still missing from npm:$(printf ' %s' $MISSING)"
  RESUMING=1
else
  RESUMING=0
fi

if [ "$RESUMING" -eq 0 ]; then
  CURRENT="$(version)"

  # -------------------------------------------------------------------------
  # Everything that can fail. Nothing has been mutated yet, so a network
  # timeout here costs you nothing but the rerun.
  # -------------------------------------------------------------------------
  step "Building"
  npm run build

  step "Testing"
  npm test

  # -------------------------------------------------------------------------
  # Mutations, local only: bump, regenerate the READMEs, relock, commit.
  # Still nothing pushed, still nothing published.
  # -------------------------------------------------------------------------
  step "Applying pending changesets"
  npx changeset version

  NEXT="$(version)"
  [ "$NEXT" != "$CURRENT" ] || fail "changeset version did not bump anything."
  echo "$CURRENT -> $NEXT"

  [ -n "$(unpublished)" ] || fail "version $NEXT is already on npm. Aborting before overwriting anything."

  # `lerna version` used to fire each package's `version` npm lifecycle hook,
  # which is what kept the command reference in every README in sync. Changesets
  # runs no lifecycle hooks at all — it only edits files — so the same command
  # has to be spelled out here, or the READMEs rot without a single warning.
  #
  # It has to happen after the bump: `oclif readme` writes source links of the
  # form .../blob/v<version>/..., which have to point at the tag this release is
  # about to create.
  step "Regenerating the oclif READMEs"
  while read -r name ver loc; do
    node -e 'process.exit(require("./" + process.argv[1] + "/package.json").oclif?.commands ? 0 : 1)' "$loc" || continue
    echo "$name"
    (cd "$loc" && npx oclif readme)
  done < <(packages)

  step "Refreshing the lockfile"
  npm install --package-lock-only

  step "Committing v$NEXT"
  git add -A
  git commit -m "v$NEXT"
fi

VERSION="$(version)"

# ---------------------------------------------------------------------------
# The irreversible step, npm first.
#
# --no-git-tag: changesets would tag every package separately
# (datocms@4.0.30, @datocms/cli-utils@4.0.30, …), retiring the vX.Y.Z tag this
# repo has used for its whole history — and which the source links inside every
# generated README point at. We tag the release once, below. Tagging after the
# publish keeps the property that matters: a tag can only exist for a version
# that is actually on the registry.
# ---------------------------------------------------------------------------
step "Publishing v$VERSION to npm"
if [ -n "$DIST_TAG" ]; then
  npx changeset publish --no-git-tag --tag "$DIST_TAG"
else
  npx changeset publish --no-git-tag
fi

# ---------------------------------------------------------------------------
# git follows npm.
# ---------------------------------------------------------------------------
step "Tagging v$VERSION"
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "v$VERSION already tagged"
else
  git tag -a "v$VERSION" -m "v$VERSION"
fi

step "Pushing to GitHub"
git push --follow-tags origin "$BRANCH"

# ---------------------------------------------------------------------------
# The release notes. Last, because it's the only step a human can redo by hand
# from the changelog if it goes wrong.
# ---------------------------------------------------------------------------
step "Publishing the release notes"
if gh release view "v$VERSION" >/dev/null 2>&1; then
  echo "the v$VERSION release already exists, leaving it alone"
else
  # A prerelease must not become the repo's "Latest release": that's reserved
  # for whatever is on the `latest` dist-tag.
  PRERELEASE=""
  case "$VERSION" in *-*) PRERELEASE="--prerelease" ;; esac
  [ -z "$DIST_TAG" ] || PRERELEASE="--prerelease"

  release_notes | gh release create "v$VERSION" --title "v$VERSION" --notes-file - $PRERELEASE
fi

# Asked for rather than parsed out of `gh release create`, so the link is the
# same whether we just created the release or found one already there.
RELEASE_URL="$(gh release view "v$VERSION" --json url --jq .url 2>/dev/null || true)"

printf '\n\033[32mReleased v%s\033[0m\n' "$VERSION"
[ -z "$RELEASE_URL" ] || printf '%s\n' "$RELEASE_URL"

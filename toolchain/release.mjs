#!/usr/bin/env node
//
// The shared release script, plus the one thing that is only true here.

import { release, reportFailure, run, step } from '@datocms/release-toolchain';

try {
  await release({
    // `oclif readme` rewrites each command's docs and the source links under
    // them, which are templated with the package's own version. Lerna used to
    // trigger this through npm's `version` lifecycle hook; `changeset version`
    // runs no lifecycle hooks at all, which is why it is spelled out here.
    //
    // Only for the packages this release tags: the links point at
    // `name@version`, so regenerating a package that isn't moving would write
    // links to a tag that will never exist. Its README keeps the links from its
    // own last release, which do resolve, until it moves again.
    beforeCommit: ({ packages, plan }) => {
      step('Regenerating the oclif READMEs');
      for (const { name } of plan) {
        const pkg = packages.find((entry) => entry.packageJson.name === name);
        if (!pkg?.packageJson.oclif?.commands) continue;
        console.log(`  ${name}`);
        run('npx', ['oclif', 'readme'], { cwd: pkg.dir });
      }
    },
  });
} catch (error) {
  reportFailure(error);
  process.exit(1);
}

import { expect, test } from '@oclif/test';

describe('datocms', () => {
  test
    .loadConfig({ root: process.cwd() })
    .stdout()
    .command(['help'])
    .it('runs help', (ctx) => {
      expect(ctx.stdout).to.contain('plugins');
    });
});

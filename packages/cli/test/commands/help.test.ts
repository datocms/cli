import { expect, test } from '@oclif/test';

describe('datocms', () => {
  test
    .stdout()
    .command(['help'])
    .it('runs help', (ctx) => {
      expect(ctx.stdout).to.contain('plugins');
    });
});

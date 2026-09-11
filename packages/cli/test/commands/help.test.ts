import { runCommand } from '@oclif/test';
import { expect } from 'chai';

describe('datocms', () => {
  it('shows the available commands', async () => {
    const { stdout, error } = await runCommand('help', {
      root: process.cwd(),
    });
    expect(error).to.equal(undefined);
    expect(stdout).to.contain('plugins');
  });
});

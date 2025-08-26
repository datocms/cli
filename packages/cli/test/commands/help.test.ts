import { runCommand } from '@oclif/test';
import { expect } from 'chai';

describe('datocms', async () => {
  const { stdout } = await runCommand('help');
  expect(stdout).to.contain('plugins');
});

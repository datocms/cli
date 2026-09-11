import { runCommand } from '@oclif/test';
import { expect } from 'chai';

const BASE_URL =
  'https://raw.githubusercontent.com/datocms/agent-skills/b22e0f87d52bd1a20f146191ba760ce46616150e/skills/datocms/references/';
const REFERENCE_URL = `${BASE_URL}cma/editing-records.md`;

describe('agents:reference', () => {
  const originalFetch = globalThis.fetch;
  let requestedUrls: string[];
  let respond: () => Promise<Response>;

  beforeEach(() => {
    requestedUrls = [];
    respond = async () => new Response('# Editing records');
    globalThis.fetch = async (input) => {
      requestedUrls.push(String(input));
      return respond();
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const run = (skill = 'datocms', name = 'cma/editing-records') =>
    runCommand(['agents:reference', skill, name], {
      root: process.cwd(),
    });

  it('fetches the pinned document and adds a missing trailing newline', async () => {
    const { stdout, error } = await run();
    expect(error).to.equal(undefined);
    expect(requestedUrls).to.deep.equal([REFERENCE_URL]);
    expect(stdout).to.equal('# Editing records\n');
  });

  it('preserves a document that already ends in a newline', async () => {
    respond = async () => new Response('# Editing records\n');
    const { stdout, error } = await run();
    expect(error).to.equal(undefined);
    expect(stdout).to.equal('# Editing records\n');
  });

  it('maps legacy skill names to their unified domains', async () => {
    for (const [skill, domain] of [
      ['datocms-cda', 'cda'],
      ['datocms-cli', 'cli'],
      ['datocms-cma', 'cma'],
      ['datocms-content-modeling', 'modeling'],
      ['datocms-frontend-integrations', 'frontend'],
      ['datocms-plugin', 'plugin'],
      ['datocms-setup', 'setup'],
      ['datocms-feedback', 'feedback'],
    ]) {
      const { stdout, error } = await run(skill, 'example-reference');
      expect(error).to.equal(undefined);
      expect(stdout).to.equal('# Editing records\n');
      expect(requestedUrls.at(-1)).to.equal(
        `${BASE_URL}${domain}/example-reference.md`,
      );
    }
    expect(requestedUrls).to.have.length(8);
  });

  it('accepts qualified references in each supported domain', async () => {
    for (const domain of [
      'cda',
      'cli',
      'cma',
      'modeling',
      'frontend',
      'plugin',
      'setup',
      'feedback',
    ]) {
      const { error } = await run('datocms', `${domain}/example-reference`);
      expect(error).to.equal(undefined);
      expect(requestedUrls.at(-1)).to.equal(
        `${BASE_URL}${domain}/example-reference.md`,
      );
    }
  });

  it('rejects unknown skills before fetching', async () => {
    const { error } = await run('datocms-missing', 'editing-records');
    expect(error?.message).to.contain('Unknown skill "datocms-missing"');
    expect(requestedUrls).to.deep.equal([]);
  });

  it('rejects invalid domains and paths before fetching', async () => {
    for (const args of [
      ['../datocms-cma', 'editing-records'],
      ['datocms-cma', '../editing-records'],
      ['datocms-cma', 'cma/editing-records'],
      ['datocms-cma', 'editing-records.md'],
      ['datocms', 'editing-records'],
      ['datocms', 'missing/editing-records'],
      ['datocms', 'CMA/editing-records'],
      ['datocms', 'cma/Editing-records'],
      ['datocms', '/editing-records'],
      ['datocms', 'cma/'],
      ['datocms', 'cma//editing-records'],
      ['datocms', 'cma/editing-records/extra'],
      ['datocms', 'cma/../editing-records'],
      ['datocms', '../cma/editing-records'],
      ['datocms', 'cma/editing-records.md'],
      ['datocms', 'cma/editing-records?raw=1'],
      ['datocms', 'cma/editing-records#section'],
      ['datocms', 'cma%2Fediting-records'],
      ['datocms', 'cma/%2e%2e'],
      ['datocms', 'cma\\editing-records'],
      ['datocms', 'cma/editing_records'],
      // runCommand reparses the arguments, so quote whitespace to preserve it.
      ['datocms', '"cma/editing-records\n"'],
      ['datocms', '"cma/editing-records\r"'],
    ]) {
      const { error } = await runCommand(['agents:reference', ...args], {
        root: process.cwd(),
      });
      expect(error?.message, JSON.stringify(args)).to.match(
        /Invalid (skill|reference) name/,
      );
    }
    expect(requestedUrls).to.deep.equal([]);
  });

  it('reports a missing reference with its pinned URL', async () => {
    respond = async () => new Response('', { status: 404 });
    const { stdout, error } = await run();
    expect(stdout).to.equal('');
    expect(error?.message).to.equal(
      `Reference "cma/editing-records" not found at ${REFERENCE_URL}`,
    );
  });

  it('preserves HTTP error details', async () => {
    respond = async () =>
      new Response('', { status: 503, statusText: 'Service Unavailable' });
    const { error } = await run();
    expect(error?.message).to.equal(
      'Failed to fetch reference "cma/editing-records": HTTP 503 Service Unavailable',
    );
  });

  it('preserves network error details', async () => {
    respond = async () => {
      throw new Error('Connection failed');
    };
    const { error } = await run();
    expect(error?.message).to.equal(
      'Failed to fetch reference "cma/editing-records": Connection failed',
    );
  });
});

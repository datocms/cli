import { runCommand } from '@oclif/test';
import { expect } from 'chai';

const REFERENCE_URL =
  'https://raw.githubusercontent.com/datocms/agent-skills/86c533b74c2913e590797eb0b2622d2cdfe5cf68/skills/datocms-cma/references/editing-records.md';

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

  const run = () =>
    runCommand(['agents:reference', 'datocms-cma', 'editing-records'], {
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

  it('rejects path traversal before fetching', async () => {
    for (const args of [
      ['../datocms-cma', 'editing-records'],
      ['datocms-cma', '../editing-records'],
    ]) {
      const { error } = await runCommand(['agents:reference', ...args], {
        root: process.cwd(),
      });
      expect(error?.message).to.match(/Invalid (skill|reference) name/);
    }
    expect(requestedUrls).to.deep.equal([]);
  });

  it('reports a missing reference with its pinned URL', async () => {
    respond = async () => new Response('', { status: 404 });
    const { stdout, error } = await run();
    expect(stdout).to.equal('');
    expect(error?.message).to.equal(
      `Reference "editing-records" not found at ${REFERENCE_URL}`,
    );
  });

  it('preserves HTTP error details', async () => {
    respond = async () =>
      new Response('', { status: 503, statusText: 'Service Unavailable' });
    const { error } = await run();
    expect(error?.message).to.equal(
      'Failed to fetch reference "editing-records": HTTP 503 Service Unavailable',
    );
  });

  it('preserves network error details', async () => {
    respond = async () => {
      throw new Error('Connection failed');
    };
    const { error } = await run();
    expect(error?.message).to.equal(
      'Failed to fetch reference "editing-records": Connection failed',
    );
  });
});

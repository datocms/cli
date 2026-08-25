import { CmaClient } from '@datocms/cli-utils';
import type { Client } from '@datocms/dashboard-client';
import { runCommand } from '@oclif/test';
import { fetch } from '@whatwg-node/fetch';
import { expect } from 'chai';
import {
  buildTestDashboardClient,
  createTestSite,
  destroyTestSite,
} from '../../../../../test-helpers/dashboardClient';
import { waitForMuxPlaybackId } from '../../../../../test-helpers/waitForMuxPlaybackId';

describe('Import from WP', () => {
  let dashboardClient: Client;
  let siteId: string | undefined;

  before(async () => {
    dashboardClient = await buildTestDashboardClient();
  });

  after(async () => {
    await destroyTestSite(dashboardClient, siteId);
  });

  it('works', async () => {
    const site = await createTestSite(dashboardClient, 'WordPress import test');
    siteId = site.id;

    const datoApiToken = site.access_token!;
    process.env.DATOCMS_API_TOKEN = datoApiToken;
    const client = CmaClient.buildClient({
      apiToken: datoApiToken,
      fetchFn: fetch,
    });

    await client.itemTypes.create({ name: 'WP Page', api_key: 'wp_page' });

    const { error: importError } = await runCommand(
      'wordpress:import --wp-url=http://localhost:8081/ --wp-username=admin --wp-password=password --autoconfirm',
    );

    // Without this, an import that fails outright shows up further down as
    // `expected 0 to equal 3`, which says nothing about why. The importer wraps
    // per-item failures in a `CuncurrentItemError` whose message names only the
    // step and the item, so the cause has to be dug out by hand.
    if (importError) {
      const { originalError } = importError as { originalError?: unknown };
      if (originalError) {
        console.error('Caused by:', originalError);
      }
      throw importError;
    }

    // =================== ASSETS ===================

    const uploads = await client.uploads.list();

    expect(uploads.length).to.eq(3);

    const computerImage = uploads.find(
      (u) => u.default_field_metadata.alt.en === 'PC Alternative Text',
    );

    expect(computerImage).to.exist;

    if (!computerImage) {
      throw new Error('type narrowing fail');
    }
    expect(computerImage.default_field_metadata.title.en).to.eq('PC Title');

    const cloudImage = uploads.find(
      (u) => u.default_field_metadata.alt.en === 'Alternative Cloud',
    );

    expect(cloudImage).to.exist;

    if (!cloudImage) {
      throw new Error('type narrowing fail');
    }

    expect(cloudImage.default_field_metadata.title.en).to.eq('Cloud Title');

    const video = uploads.find((u) => u.format === 'mp4');

    expect(video).to.exist;

    if (!video) {
      throw new Error('type narrowing fail');
    }

    expect(video.default_field_metadata.title.en).to.eq('beach');
    expect((await waitForMuxPlaybackId(client, video.id)).mux_playback_id).to
      .not.be.null;

    // =================== CATEGORIES ===================

    const categories = await client.items.list({
      filter: { type: 'wp_category' },
    });

    expect(categories.filter((c) => c.parent_id).length).to.eq(2);
    expect(categories.map((m) => m.slug)).to.have.all.members([
      'top-level',
      'sub-level',
      'third-level',
      'uncategorized',
    ]);

    const topLevel = categories.find((c) => c.slug === 'top-level')!;
    expect(topLevel.parent_id).to.be.null;
    expect(topLevel.name).to.eq('Top level');
    expect(topLevel.description).to.eq('Some description.');

    const subLevel = categories.find((c) => c.slug === 'sub-level')!;
    expect(subLevel.parent_id).to.eq(topLevel.id);
    expect(subLevel.name).to.eq('Sub level');

    const thirdLevel = categories.find((c) => c.slug === 'third-level')!;
    expect(thirdLevel.parent_id).to.eq(subLevel.id);
    expect(thirdLevel.name).to.eq('Third level');

    // =================== TAGS ===================

    const tags = await client.items.list({
      filter: { type: 'wp_tag' },
    });

    expect(tags.map((m) => m.slug)).to.have.all.members([
      'first',
      'second',
      'third',
    ]);

    const firstTag = tags.find((t) => t.slug === 'first')!;
    expect(firstTag.name).to.eq('First');

    // =================== AUTHORS ===================

    const authors = await client.items.list({
      filter: { type: 'wp_author' },
    });

    const author = authors[0]!;

    expect(author.name).to.eq('admin');
    expect(author.slug).to.eq('admin');
    expect(author.url).to.eq('https://foo.bar');
    expect(author.description).to.eq('This is my bio');

    // =================== PAGES ===================

    const pages = await client.items.list({
      filter: { type: 'wp_page' },
    });
    expect(pages.length).to.eq(1);
    expect(pages[0].slug).to.eq('sample-page');

    // =================== ARTICLES ===================

    const articles = await client.items.list({
      filter: { type: 'wp_article' },
    });

    const article = articles[0];

    expect(articles.length).to.eq(1);
    expect(article.slug).to.eq('hello-world');

    expect(article.content).to.include(computerImage.url);
    expect(article.content).to.include(cloudImage.url);
    expect(article.tags).to.have.all.members(tags.map((c) => c.id));

    expect(article.categories).to.have.all.members(categories.map((c) => c.id));

    expect(article.featured_media).to.include({
      alt: 'Hello world!',
      title: 'Hello world!',
      focal_point: null,
      upload_id: cloudImage.id,
    });
  });
});

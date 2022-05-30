import { expect } from '@oclif/test';
import { buildClient as buildDashboardClient } from '@datocms/dashboard-client';
import { buildClient as buildCmaClient } from '@datocms/cma-client-node';
import ImportCommand from '../../../src/commands/wordpress/import';

describe('Import from WP', () => {
  it('works', async () => {
    const randomString = Math.random().toString(36).slice(0, 7) + Date.now();

    const nonLoggedDashboardClient = buildDashboardClient({
      apiToken: null,
      baseUrl: process.env.ACCOUNT_API_BASE_URL,
    });

    const account = await nonLoggedDashboardClient.account.create({
      email: `${randomString}@delete-this-at-midnight-utc.tk`,
      password: 'STRONG_pass123!',
      first_name: 'Test',
      company: 'DatoCMS',
    });

    const dashboardClient = buildDashboardClient({
      apiToken: account.id,
      baseUrl: process.env.ACCOUNT_API_BASE_URL,
    });

    const site = await dashboardClient.sites.create({
      name: 'Project',
    });

    console.log(
      `Project: https://${site.internal_subdomain}.admin.datocms.com/`,
    );

    const datoApiToken = site.readwrite_token!;
    process.env.DATOCMS_API_TOKEN = datoApiToken;
    const client = buildCmaClient({
      apiToken: datoApiToken,
    });

    await client.itemTypes.create({ name: 'WP Page', api_key: 'wp_page' });

    await ImportCommand.run([
      '--wp-url=http://localhost:8081/',
      '--wp-username=admin',
      '--wp-password=password',
      '--autoconfirm',
    ]);

    // =================== ASSETS ===================

    const uploads = await client.uploads.list();

    expect(uploads.length).to.eq(3);

    const computerImage = uploads.find(
      (u) => u.default_field_metadata.en.alt === 'PC Alternative Text',
    );

    expect(computerImage).to.exist;

    if (!computerImage) {
      throw new Error('type narrowing fail');
    }
    expect(computerImage.default_field_metadata.en.title).to.eq('PC Title');

    const cloudImage = uploads.find(
      (u) => u.default_field_metadata.en.alt === 'Alternative Cloud',
    );

    expect(cloudImage).to.exist;

    if (!cloudImage) {
      throw new Error('type narrowing fail');
    }

    expect(cloudImage.default_field_metadata.en.title).to.eq('Cloud Title');

    const video = uploads.find((u) => u.format === 'mp4');

    expect(video).to.exist;

    if (!video) {
      throw new Error('type narrowing fail');
    }

    expect(video.default_field_metadata.en.title).to.eq('beach');
    expect(video.mux_playback_id).to.not.be.null;

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

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

    expect(computerImage?.default_field_metadata.en.title).to.eq('PC Title');

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

    // =================== TAGS ===================

    const tags = await client.items.list({
      filter: { type: 'wp_tag' },
    });

    expect(tags.map((m) => m.slug)).to.have.all.members([
      'first',
      'second',
      'third',
    ]);

    // =================== AUTHORS ===================

    const authors = await client.items.list({
      filter: { type: 'wp_author' },
    });

    expect(authors[0].name).to.eq('admin');

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

    expect(article.content).to.include(
      `srcset="${computerImage?.url}?w=300&h=270&fit=crop 300w, ${computerImage?.url}?w=408&h=367&fit=crop 408w"`,
    );
    expect(article.content).to.include(
      `class="wp-image-6" srcset="${cloudImage.url}?w=736&h=736&fit=crop 736w, ${cloudImage.url}?w=300&h=300&fit=crop 300w, ${cloudImage.url}?w=150&h=150&fit=crop 150w"`,
    );
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

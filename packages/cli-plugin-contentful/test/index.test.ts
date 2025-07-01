import { CmaClient } from '@datocms/cli-utils';
import { buildClient as buildDashboardClient } from '@datocms/dashboard-client';
import { expect } from '@oclif/test';
import type { StructuredText } from 'datocms-structured-text-utils';
import get from 'lodash/get';
import ImportCommand from '../src/commands/contentful/import';
import type { UploadData } from '../src/utils/item-create-helpers';
interface BlogPostType extends CmaClient.SimpleSchemaTypes.Item {
  author: CmaClient.SimpleSchemaTypes.ItemIdentity | null;
  title: { 'en-US': string | null; it?: string | null };
  hero_image: UploadData | null;
  gallery: UploadData[] | [];
}
interface AuthorType extends CmaClient.SimpleSchemaTypes.Item {
  name: string;
}
interface LandingPageType extends CmaClient.SimpleSchemaTypes.Item {
  title: string;
  latest_posts: CmaClient.SimpleSchemaTypes.ItemIdentity | null;
  content: StructuredText['value'];
}

describe('Import from Contentful', () => {
  it('works', async () => {
    if (!process.env.CONTENTFUL_TOKEN) {
      throw new Error(
        'Missing env variable CONTENTFUL_TOKEN! Cannot run tests!',
      );
    }

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

    const datoApiToken = site.access_token!;
    process.env.DATOCMS_API_TOKEN = datoApiToken;
    const client = CmaClient.buildClient({
      apiToken: datoApiToken,
    });

    // ========= SKIP CONTENT ==================
    await ImportCommand.run([
      `--contentful-token=${process.env.CONTENTFUL_TOKEN}`,
      '--contentful-space-id=gjarw06urmh5',
      '--autoconfirm',
      '--only-content-type=landingPage',
      '--skip-content',
    ]);

    const skipContentModels = await client.itemTypes.list();
    expect(skipContentModels.length).to.eq(1);

    const skipContentItems = await client.items.list();
    expect(skipContentItems.length).to.eq(0);

    // ========= IMPORT FULL PROJECT ==================
    await ImportCommand.run([
      `--contentful-token=${process.env.CONTENTFUL_TOKEN}`,
      '--contentful-space-id=gjarw06urmh5',
      '--autoconfirm',
    ]);

    const createdSite = await client.site.find();
    expect(createdSite.locales).to.have.all.members(['en-US', 'it']);

    // // =================== MODELS ===================
    const models = await client.itemTypes.list();
    expect(models.length).to.eq(4);

    const blogPostModel = models.find((m) => m.api_key === 'blog_post_model');
    expect(blogPostModel).to.exist;

    const landingModel = models.find((m) => m.api_key === 'landing_page_model');
    expect(landingModel).to.exist;

    const authorModel = models.find((m) => m.api_key === 'person_model');
    expect(authorModel).to.exist;

    const assetBlock = models.find((m) => m.modular_block);
    expect(assetBlock?.api_key).to.eq('structured_text_asset');

    if (!(blogPostModel && landingModel && authorModel && assetBlock)) {
      return;
    }

    // // =================== FIELDS ===================

    const blogPostFields = await client.fields.list(blogPostModel.id);
    // expect(blogPostFields.length).to.eq(8);

    const authorLinkField = blogPostFields.find(
      (f: CmaClient.SimpleSchemaTypes.Field) => f.field_type === 'link',
    );
    const postValidators = authorLinkField?.validators.item_item_type as Record<
      'item_types',
      CmaClient.SimpleSchemaTypes.ItemTypeIdentity[]
    >;
    expect(postValidators.item_types).to.have.all.members([authorModel.id]);

    const landingFields = await client.fields.list(landingModel.id);
    const landingRichTextField = landingFields.find(
      (f: CmaClient.SimpleSchemaTypes.Field) =>
        f.field_type === 'structured_text',
    );
    const landingLinkedModels = landingRichTextField?.validators
      .structured_text_blocks as Record<
      'item_types',
      CmaClient.SimpleSchemaTypes.ItemTypeIdentity[]
    >;
    expect(landingLinkedModels.item_types).to.have.all.members([assetBlock.id]);

    const floatField = blogPostFields.find(
      (f: CmaClient.SimpleSchemaTypes.Field) => f.field_type === 'float',
    );
    expect(floatField?.validators).to.deep.equal({
      number_range: { min: 0.5 },
    });

    const integerField = blogPostFields.find(
      (f: CmaClient.SimpleSchemaTypes.Field) => f.field_type === 'integer',
    );
    expect(integerField?.validators).to.deep.equal({
      number_range: { min: 1, max: 200 },
    });

    const dateField = blogPostFields.find(
      (f: CmaClient.SimpleSchemaTypes.Field) => f.field_type === 'date_time',
    );
    expect(dateField?.validators).to.deep.equal({
      required: {},
      date_time_range: {
        min: '2022-06-01T01:00:00+01:00',
        max: '2022-06-10T23:00:00+01:00',
      },
    });

    const assetField = blogPostFields.find(
      (f: CmaClient.SimpleSchemaTypes.Field) => f.field_type === 'file',
    );
    expect(assetField?.validators).to.deep.equal({
      required: {},
      file_size: {
        min_value: 1,
        max_value: 104_857_600,
        min_unit: 'B',
        max_unit: 'B',
      },
    });

    const galleryField = blogPostFields.find(
      (f: CmaClient.SimpleSchemaTypes.Field) => f.field_type === 'gallery',
    );
    expect(galleryField?.validators).to.deep.equal({
      size: { min: 1, max: 3 },
    });

    // // =================== ASSETS ===================

    const uploads = await client.uploads.list();
    expect(uploads.length).to.eq(3);

    const computerImage = uploads.find(
      (u) => u.default_field_metadata['en-US'].title === 'Computer',
    );
    expect(computerImage?.default_field_metadata['en-US'].alt).to.eq(
      'Computer pixel',
    );
    expect(computerImage?.default_field_metadata.it.title).to.eq(
      'Computer ITA',
    );

    const video = uploads.find((u) => u.format === 'mp4');
    expect(video).to.exist;

    expect(video?.default_field_metadata['en-US'].title).to.eq('beach video');
    expect(video?.mux_playback_id).to.not.be.null;

    // // =================== RECORDS ===================

    const blogPostArticles = (await client.items.list({
      filter: { type: blogPostModel.api_key },
      version: 'current',
    })) as BlogPostType[];

    expect(blogPostArticles.length).to.eq(2);

    const unpublishedArticle = blogPostArticles.find(
      (a) => a.slug === 'static',
    );

    expect(unpublishedArticle?.meta.status).to.eq('draft');
    expect(unpublishedArticle?.title).to.have.own.property('en-US');
    expect(unpublishedArticle?.title?.['en-US']).to.eq(
      'Static sites are great',
    );
    expect(unpublishedArticle?.title).to.have.own.property('it');
    expect(unpublishedArticle?.title?.it).to.eq('');

    const publishedArticle = blogPostArticles.find((a) => a.slug === 'hello');
    expect(publishedArticle?.meta.status).to.eq('published');
    expect(publishedArticle?.title.it).to.eq('Ciao Mondo!');
    expect(publishedArticle?.hero_image?.upload_id).to.eq(computerImage?.id);
    expect(publishedArticle?.number).to.eq(1.4);
    expect(publishedArticle?.integer).to.eq(12);
    expect(publishedArticle?.tags).to.eq('general, javascript');
    expect(publishedArticle?.gallery[0].upload_id).to.eq(video?.id);
    expect(publishedArticle?.location).to.deep.equal({
      latitude: 52.52,
      longitude: 13.40495,
    });
    expect(publishedArticle?.body).to.include(`${computerImage?.url}`);

    // // =================== LINKS ===================
    const authors = (await client.items.list({
      filter: { type: authorModel.api_key },
      version: 'current',
    })) as AuthorType[];

    const author = authors[0];
    expect(publishedArticle?.author).to.eq(author.id);
    expect(unpublishedArticle?.author).to.eq(author.id);
    expect(unpublishedArticle?.hero_image?.upload_id).to.eq(computerImage?.id);
    expect(
      unpublishedArticle?.gallery.map((i) => i.upload_id),
    ).to.have.all.members([computerImage?.id, video?.id]);

    const landings = (await client.items.list({
      filter: { type: landingModel.api_key },
      version: 'current',
    })) as LandingPageType[];

    const landing = landings[0];
    expect(landing?.latest_posts).to.have.all.members([
      publishedArticle?.id,
      unpublishedArticle?.id,
    ]);

    // // =================== STRUCTURED TEXT ===================

    const content = landing?.content.document.children;

    const expectedHeading = get(content, '[0]');
    expect(expectedHeading).to.deep.equal({
      type: 'heading',
      level: 1,
      children: [
        {
          type: 'span',
          value: 'Lorem ipsum',
        },
      ],
    });

    const expectedParagraph = get(content, '[1]');
    expect(expectedParagraph).to.deep.equal({
      type: 'paragraph',
      children: [
        {
          type: 'span',
          marks: ['strong'],
          value: 'Lorem ipsum,',
        },
        {
          type: 'span',
          marks: ['emphasis'],
          value: ' et dolore magna aliqua',
        },
      ],
    });

    const expectedInlineItem = get(content, '[2].children[0].item');
    expect(expectedInlineItem).to.eq(publishedArticle?.id);

    const expectedCode = get(content, '[3]');
    expect(expectedCode).to.deep.equal({
      code: 'const foo = "bar";',
      type: 'code',
    });

    const expectedInlineLink = get(content, '[4].children');
    expect(expectedInlineLink).to.deep.equal([
      {
        type: 'span',
        value: 'Duis ',
      },
      {
        item: author.id,
        type: 'itemLink',
        children: [
          {
            type: 'span',
            value: 'in reprehenderit',
          },
        ],
      },
      {
        type: 'span',
        value: ' in nulla pariatur.',
      },
    ]);

    expect(get(content, '[5].type')).to.eq('block');

    expect(get(content, '[6].type')).to.eq('blockquote');

    expect(get(content, '[7].children[0].item')).to.eq(author.id);

    expect(get(content, '[8].type')).to.eq('thematicBreak');

    const expectedLinkToAsset = get(content, '[9].children[1]');
    expect(expectedLinkToAsset).to.deep.equal({
      url: computerImage?.url,
      type: 'link',
      children: [
        {
          type: 'span',
          value: 'Asset hyperlink',
        },
      ],
    });

    expect(landing.meta.status).to.eq('updated');
  });
});

import { Listr, ListrTaskWrapper, ListrRendererFactory } from 'listr2';
import convertToRegExp from '../utils/escape-string-regexp';
import { CmaClient } from '@datocms/cli-utils';
import { Context } from '../commands/wordpress/import';
import BaseStep from './base-step';
import {
  createSlugField,
  createStringField,
  createTextField,
} from '../utils/build-fields';

const retrieveTitle = 'Retrieve pages from WordPress';
const createTitle = 'Import pages to DatoCMS';

export default class WpPages extends BaseStep {
  task(): Listr {
    return new Listr<Context>([
      {
        title: 'Create DatoCMS model',
        task: this.createPageModel.bind(this),
      },
      {
        title: retrieveTitle,
        task: this.retrievePages.bind(this),
      },
      {
        title: createTitle,
        task: this.createPages.bind(this),
      },
    ]);
  }

  async createPageModel(ctx: Context): Promise<void> {
    if (!ctx.datoItemTypes.author) {
      throw new Error('This should not happen!');
    }

    const itemType = await this.client.itemTypes.create({
      api_key: 'wp_page',
      draft_mode_active: true,
      name: 'WP Page',
    });

    const promiseBuilder = [
      createStringField(this.client, itemType, 'title').then((field) =>
        createSlugField(this.client, itemType, field.id),
      ),
      ...['excerpt', 'content'].map((apiKey: string) =>
        createTextField(this.client, itemType, apiKey),
      ),
      this.client.fields.create(itemType.id, {
        api_key: 'featured_media',
        field_type: 'file',
        label: 'Main image',
        validators: {},
      }),
      this.client.fields.create(itemType.id, {
        api_key: 'author',
        field_type: 'link',
        label: 'Author',
        validators: {
          item_item_type: { item_types: [ctx.datoItemTypes.author.id] },
        },
      }),
    ];

    await Promise.all(promiseBuilder);

    ctx.datoItemTypes.page = itemType;
  }

  async retrievePages(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    // Currently there's no way to fetch draft articles/pages from WP
    ctx.wpPages = await this.fetchAllWpPages(
      task,
      retrieveTitle,
      this.wpClient.pages(),
    );
  }

  async createPages(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    if (
      !(
        ctx.wpPages &&
        ctx.datoItemTypes.page &&
        ctx.wpAssetUrlToDatoUrl &&
        ctx.wpAssetIdToDatoId &&
        ctx.authorsMapping
      )
    ) {
      throw new Error('This should not happen!');
    }

    const wpPages = ctx.wpPages;
    const pageItemType = ctx.datoItemTypes.page;
    const wpAssetUrlToDatoUrl = ctx.wpAssetUrlToDatoUrl;
    const wpAssetIdToDatoId = ctx.wpAssetIdToDatoId;
    const authorsMapping = ctx.authorsMapping;

    await this.runConcurrentlyOver(
      task,
      createTitle,
      wpPages,
      (wpPage) => wpPage.title.rendered,
      async (wpPage) => {
        const itemData: CmaClient.SimpleSchemaTypes.ItemCreateSchema = {
          item_type: pageItemType,
          title: wpPage.title.rendered,
          slug: wpPage.slug,
          content: Object.entries(wpAssetUrlToDatoUrl).reduce(
            (acc, [k, v]) =>
              acc.replace(new RegExp(convertToRegExp(k), 'ig'), v),
            wpPage.content.rendered,
          ),
          excerpt: Object.entries(wpAssetUrlToDatoUrl).reduce(
            (acc, [k, v]) =>
              acc.replace(new RegExp(convertToRegExp(k), 'ig'), v),
            wpPage.excerpt.rendered,
          ),
          author: authorsMapping[wpPage.author],
          featured_media: null,
          meta: {
            first_published_at: wpPage.date,
            created_at: wpPage.date,
          },
        };

        if (wpPage.featured_media) {
          itemData.featured_media = {
            upload_id: wpAssetIdToDatoId[wpPage.featured_media],
            title: wpPage.title.rendered,
            alt: wpPage.title.rendered,
            custom_data: {},
          };
        }

        const newItem = await this.client.items.create(itemData);

        if (wpPage.status === 'publish') {
          await this.client.items.publish(newItem.id);
        }
      },
    );
  }
}

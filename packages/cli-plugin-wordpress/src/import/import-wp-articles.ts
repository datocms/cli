import type { CmaClient } from '@datocms/cli-utils';
import {
  Listr,
  type ListrRendererFactory,
  type ListrTaskWrapper,
} from 'listr2';
import type { Context } from '../commands/wordpress/import';
import {
  createSlugField,
  createStringField,
  createTextField,
} from '../utils/build-fields';
import convertToRegExp from '../utils/escape-string-regexp';
import BaseStep from './base-step';

const retrieveTitle = 'Retrieve articles from WordPress';
const createTitle = 'Import articles to DatoCMS';
export default class WpArticles extends BaseStep {
  task(): Listr {
    return new Listr<Context>([
      {
        title: 'Create DatoCMS model',
        task: this.createArticleModel.bind(this),
      },
      {
        title: retrieveTitle,
        task: this.retrieveArticles.bind(this),
      },
      {
        title: createTitle,
        task: this.createArticles.bind(this),
      },
    ]);
  }

  async createArticleModel(ctx: Context): Promise<void> {
    if (
      !(
        ctx.datoItemTypes.author &&
        ctx.datoItemTypes.category &&
        ctx.datoItemTypes.tag
      )
    ) {
      throw new Error('This should not happen!');
    }

    const itemType = await this.client.itemTypes.create({
      api_key: 'wp_article',
      name: 'WP Article',
      draft_mode_active: true,
    });

    const promiseBuilder = [
      createStringField(this.client, itemType, 'title').then((field) =>
        createSlugField(this.client, itemType, field.id),
      ),
      ...['excerpt', 'content'].map((apiKey) =>
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
      this.client.fields.create(itemType.id, {
        api_key: 'categories',
        field_type: 'links',
        label: 'Categories',
        validators: {
          items_item_type: { item_types: [ctx.datoItemTypes.category.id] },
        },
      }),
      this.client.fields.create(itemType.id, {
        api_key: 'tags',
        field_type: 'links',
        label: 'Tags',
        validators: {
          items_item_type: { item_types: [ctx.datoItemTypes.tag.id] },
        },
      }),
    ];

    await Promise.all(promiseBuilder);

    ctx.datoItemTypes.article = itemType;
  }

  async retrieveArticles(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    // Currently there's no way to fetch draft articles/pages from WP
    ctx.wpArticles = await this.fetchAllWpPages(
      task,
      retrieveTitle,
      this.wpClient.posts(),
    );
  }

  async createArticles(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    if (
      !(
        ctx.wpArticles &&
        ctx.datoItemTypes.article &&
        ctx.wpAssetUrlToDatoUrl &&
        ctx.wpAssetIdToDatoId &&
        ctx.categoriesMapping &&
        ctx.tagsMapping &&
        ctx.authorsMapping
      )
    ) {
      throw new Error('This should not happen!');
    }

    const wpArticles = ctx.wpArticles;
    const articlesItemType = ctx.datoItemTypes.article;
    const wpAssetUrlToDatoUrl = ctx.wpAssetUrlToDatoUrl;
    const wpAssetIdToDatoId = ctx.wpAssetIdToDatoId;
    const categoriesMapping = ctx.categoriesMapping;
    const tagsMapping = ctx.tagsMapping;
    const authorsMapping = ctx.authorsMapping;

    await this.runConcurrentlyOver(
      task,
      createTitle,
      wpArticles,
      (wpArticle) => wpArticle.title.rendered,
      async (wpArticle, notify) => {
        const itemData: CmaClient.SimpleSchemaTypes.ItemCreateSchema = {
          item_type: articlesItemType,
          title: wpArticle.title.rendered,
          slug: wpArticle.slug,
          content: Object.entries(wpAssetUrlToDatoUrl).reduce(
            (acc, [k, v]) =>
              acc.replace(new RegExp(convertToRegExp(k), 'ig'), v),
            wpArticle.content.rendered,
          ),
          excerpt: Object.entries(wpAssetUrlToDatoUrl).reduce(
            (acc, [k, v]) =>
              acc.replace(new RegExp(convertToRegExp(k), 'ig'), v),
            wpArticle.excerpt.rendered,
          ),
          author: authorsMapping[wpArticle.author],
          featured_media: null,
          meta: {
            first_published_at: wpArticle.date,
            created_at: wpArticle.date,
          },
          categories: wpArticle.categories.map(
            (id: string) => categoriesMapping[id],
          ),
          tags: wpArticle.tags.map((id: string) => tagsMapping[id]),
        };

        if (wpArticle.featured_media) {
          itemData.featured_media = {
            upload_id: wpAssetIdToDatoId[wpArticle.featured_media],
            title: wpArticle.title.rendered,
            alt: wpArticle.title.rendered,
            custom_data: {},
          };
        }

        const newItem = await this.client.items.create(itemData);

        if (wpArticle.status === 'publish') {
          notify('publishing');
          await this.client.items.publish(newItem);
        }
      },
    );
  }
}

import { Listr, ListrTaskWrapper, ListrRendererFactory } from 'listr2';
import { Context } from '../commands/wordpress/import';
import BaseStep from './base-step';
import {
  createSlugField,
  createStringField,
  createTextField,
} from '../utils/build-fields';
import { writeFile } from 'fs/promises';

const retrieveTitle = 'Retrieve authors from WordPress';
const createTitle = 'Import authors to DatoCMS';
export default class WpAuthors extends BaseStep {
  task(): Listr {
    return new Listr<Context>([
      {
        title: 'Create DatoCMS model',
        task: this.createAuthorModel.bind(this),
      },
      {
        title: retrieveTitle,
        task: this.retrieveAuthors.bind(this),
      },
      {
        title: createTitle,
        task: this.createAuthors.bind(this),
      },
    ]);
  }

  async createAuthorModel(ctx: Context): Promise<void> {
    const itemType = await this.client.itemTypes.create({
      api_key: 'wp_author',
      name: 'WP Author',
    });

    await Promise.all([
      createStringField(this.client, itemType, 'name').then((field) =>
        createSlugField(this.client, itemType, field.id),
      ),
      createStringField(this.client, itemType, 'url'),
      createTextField(this.client, itemType, 'description'),
    ]);

    ctx.datoItemTypes.author = itemType;
  }

  async retrieveAuthors(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.wpAuthors = await this.fetchAllWpPages(
      task,
      retrieveTitle,
      this.wpClient.users(),
    );
  }

  async createAuthors(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    if (!ctx.wpAuthors || !ctx.datoItemTypes.author) {
      throw new Error('This should not happen!');
    }

    const wpAuthors = ctx.wpAuthors;
    const authorItemType = ctx.datoItemTypes.author;
    const authorsMapping: Record<string, string> = {};

    await this.runConcurrentlyOver(
      task,
      createTitle,
      wpAuthors,
      (wpAuthor) => wpAuthor.name,
      async (wpAuthor) => {
        const datoAuthor = await this.client.items.create({
          item_type: authorItemType,
          name: wpAuthor.name,
          slug: wpAuthor.slug,
          url: wpAuthor.url,
          description: wpAuthor.description,
        });

        authorsMapping[wpAuthor.id] = datoAuthor.id;
      },
    );

    ctx.authorsMapping = authorsMapping;
  }
}

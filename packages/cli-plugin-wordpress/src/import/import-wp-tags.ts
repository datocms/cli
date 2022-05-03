import { Listr, ListrTaskWrapper, ListrRendererFactory } from 'listr2';
import { Context } from '../commands/wordpress/import';
import BaseStep from './base-step';
import { createStringField } from '../utils/build-fields';

const retrieveTitle = 'Retrieve tags from WordPress';
const createTitle = 'Import tags to DatoCMS';

export default class WpTags extends BaseStep {
  task(): Listr {
    return new Listr<Context>([
      {
        title: 'Create DatoCMS model',
        task: this.createTagModel.bind(this),
      },
      {
        title: retrieveTitle,
        task: this.retrieveTags.bind(this),
      },
      {
        title: createTitle,
        task: this.createTags.bind(this),
      },
    ]);
  }

  async createTagModel(ctx: Context): Promise<void> {
    const itemType = await this.client.itemTypes.create({
      api_key: 'wp_tag',
      name: 'WP Tag',
    });

    await Promise.all(
      ['name', 'slug'].map((apiKey) =>
        createStringField(this.client, itemType, apiKey),
      ),
    );

    ctx.datoItemTypes.tag = itemType;
  }

  async retrieveTags(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.wpTags = await this.fetchAllWpPages(
      task,
      retrieveTitle,
      this.wpClient.tags(),
    );
  }

  async createTags(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    if (!ctx.wpTags || !ctx.datoItemTypes.tag) {
      throw new Error('This should not happen!');
    }

    const wpTags = ctx.wpTags;
    const tagItemType = ctx.datoItemTypes.tag;
    const tagsMapping: Record<string, string> = {};

    await this.runConcurrentlyOver(
      task,
      createTitle,
      wpTags,
      (wpTag) => wpTag.name,
      async (wpTag) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 3_000);
        });

        const datoTag = await this.client.items.create({
          item_type: tagItemType,
          name: wpTag.name,
          slug: wpTag.slug,
        });

        tagsMapping[wpTag.id] = datoTag.id;
      },
    );

    ctx.tagsMapping = tagsMapping;
  }
}

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
import BaseStep from './base-step';

const retrieveTitle = 'Retrieve categories from WordPress';
const createTitle = 'Import categories to DatoCMS';
const treeTitle = 'Create category tree';

export default class WpCategories extends BaseStep {
  task(): Listr {
    return new Listr<Context>([
      {
        title: 'Create DatoCMS model',
        task: this.createCategoryModel.bind(this),
      },
      {
        title: retrieveTitle,
        task: this.retrieveCategories.bind(this),
      },
      {
        title: createTitle,
        task: this.createCategories.bind(this),
      },
      {
        title: treeTitle,
        task: this.createCategoryTree.bind(this),
      },
    ]);
  }

  async createCategoryModel(ctx: Context): Promise<void> {
    const itemType = await this.client.itemTypes.create({
      api_key: 'wp_category',
      name: 'WP Category',
      tree: true,
    });

    await Promise.all([
      createStringField(this.client, itemType, 'name').then((field) =>
        createSlugField(this.client, itemType, field.id),
      ),
      createTextField(this.client, itemType, 'description'),
    ]);

    ctx.datoItemTypes.category = itemType;
  }

  async retrieveCategories(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.wpCategories = await this.fetchAllWpPages(
      task,
      retrieveTitle,
      this.wpClient.categories(),
    );
  }

  async createCategories(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    if (!(ctx.wpCategories && ctx.datoItemTypes.category)) {
      throw new Error('This should not happen!');
    }

    const wpCategories = ctx.wpCategories;
    const categoryItemType = ctx.datoItemTypes.category;
    const categoriesMapping: Record<string, string> = {};

    await this.runConcurrentlyOver(
      task,
      createTitle,
      wpCategories,
      (wpCategory) => wpCategory.name,
      async (wpCategory) => {
        const datoCategory = await this.client.items.create({
          item_type: categoryItemType,
          name: wpCategory.name,
          slug: wpCategory.slug,
          description: wpCategory.description,
        });

        categoriesMapping[wpCategory.id] = datoCategory.id;
      },
    );

    ctx.categoriesMapping = categoriesMapping;
  }

  async createCategoryTree(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    if (!(ctx.wpCategories && ctx.categoriesMapping)) {
      throw new Error('This should not happen!');
    }

    const categoriesMapping = ctx.categoriesMapping;

    const wpChildCategories = ctx.wpCategories.filter((wpCategory) =>
      Boolean(wpCategory.parent),
    );

    await this.runConcurrentlyOver(
      task,
      treeTitle,
      wpChildCategories,
      (wpCategory) => wpCategory.name,
      async (wpCategory) => {
        await this.client.items.update(categoriesMapping[wpCategory.id], {
          parent_id: categoriesMapping[wpCategory.parent],
        });
      },
    );
  }
}

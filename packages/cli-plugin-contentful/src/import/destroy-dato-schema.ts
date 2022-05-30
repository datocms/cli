import BaseStep from './base-step';
import { ContentTypeProps } from 'contentful-management';
import { Context } from '../commands/contentful/import';
import { Listr, ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import { toItemTypeApiKey } from '../utils/item-type-create-helpers';
import { isLinkType } from '../utils/item-create-helpers';

const removeValidationsLog = 'Removing validations from fields';
const destroyModelsLog = 'Destroying Contentful models from DatoCMS';
const destroyUnusedAssetsLog = 'Destroying unused assets from DatoCMS';
export default class DestroyDatoSchema extends BaseStep {
  async task(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<Listr> {
    const contentfulTypes = await this.cfEnvironmentApi.getContentTypes();

    ctx.contentTypes = this.options.importOnly
      ? contentfulTypes.items.filter((type) =>
          this.options.importOnly?.includes(type.sys.id),
        )
      : contentfulTypes.items;

    ctx.datoItemTypes = await this.client.itemTypes.list();

    const contentfulTypeApiKeys = new Set(
      ctx.contentTypes.map((c: ContentTypeProps) => toItemTypeApiKey(c.sys.id)),
    );

    ctx.itemTypesToDestroy = ctx.datoItemTypes.filter((iT) =>
      contentfulTypeApiKeys.has(iT.api_key),
    );

    if (!this.autoconfirm) {
      const modelsToDestroyApiKeys = ctx.itemTypesToDestroy.map(
        (m) => m.api_key,
      );

      const confirmed = await task.prompt<boolean>({
        type: 'Confirm',
        message: `These models already exist in your DatoCMS project:
* ${modelsToDestroyApiKeys.join('\n * ')}
To proceed with the importing, you need to destroy them, and re-create them. 
Confirm that you want to destroy them?`,
      });

      if (!confirmed) {
        throw new Error('Model importing interrupted by user request');
      }
    }

    return new Listr<Context>([
      {
        title: removeValidationsLog,
        task: this.removeValidations.bind(this),
        enabled: ctx.itemTypesToDestroy.length > 0,
      },
      {
        title: destroyModelsLog,
        task: this.destroyModels.bind(this),
        enabled: ctx.itemTypesToDestroy.length > 0,
      },
      {
        title: destroyUnusedAssetsLog,
        task: this.destroyUnusedAssets.bind(this),
      },
    ]);
  }

  async removeValidations(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    const itemTypesToDestroyIds = new Set(
      ctx.itemTypesToDestroy.map((i) => i.id),
    );

    await this.runConcurrentlyOver(
      task,
      removeValidationsLog,
      ctx.datoItemTypes,
      (itemType) => itemType.id,
      async (itemType) => {
        const allFields = await this.client.fields.list(itemType.id);

        for (const field of allFields.filter((f) => isLinkType(f.field_type))) {
          const containsValidations =
            field.validators.item_item_type &&
            (field.validators.item_item_type as string[]).filter((x) =>
              itemTypesToDestroyIds.has(x),
            );

          if (containsValidations) {
            await this.client.fields.update(field.id, {
              validators: { item_item_type: containsValidations },
            });
          }

          const containsMultipleValidations =
            field.validators.item_item_type &&
            (field.validators.item_item_type as string[]).filter((x) =>
              itemTypesToDestroyIds.has(x),
            );

          if (containsMultipleValidations) {
            await this.client.fields.update(field.id, {
              validators: { items_item_type: containsMultipleValidations },
            });
          }
        }
      },
    );
  }

  async destroyModels(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    await this.runConcurrentlyOver(
      task,
      destroyModelsLog,
      ctx.itemTypesToDestroy,
      (itemType) => itemType.id,
      async (itemType) => {
        await this.client.itemTypes.destroy(itemType);
      },
    );
  }

  async destroyUnusedAssets(
    _ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    const uploadsToDestroy = await this.client.uploads.list({
      'filter[fields][in_use][eq]': 'not_used',
    });

    if (uploadsToDestroy.length === 0) {
      task.skip('No unused assets');
      return;
    }

    if (!this.autoconfirm) {
      const confirmed = await task.prompt<boolean>({
        type: 'Confirm',
        message:
          'This action will destroy all unused assets from your media library. Confirm that you want to destroy them?',
      });

      if (!confirmed) {
        throw new Error('Asset importing interrupted by user request');
      }
    }

    await this.runConcurrentlyOver(
      task,
      destroyUnusedAssetsLog,
      uploadsToDestroy,
      (upload) => upload.id,
      async (upload) => {
        await this.client.uploads.destroy(upload);
      },
    );
  }
}

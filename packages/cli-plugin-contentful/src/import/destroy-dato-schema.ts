import type { ContentTypeProps } from 'contentful-management';
import {
  Listr,
  type ListrRendererFactory,
  type ListrTaskWrapper,
} from 'listr2';
import type { Context } from '../commands/contentful/import';
import { getAll } from '../utils/getAll';
import { toItemTypeApiKey } from '../utils/item-type-create-helpers';
import BaseStep from './base-step';

const removeValidationsLog = 'Removing validations from fields';
const destroyModelsLog = 'Destroying Contentful models from DatoCMS';
export default class DestroyDatoSchema extends BaseStep {
  async task(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<Listr> {
    ctx.datoItemTypes = await this.client.itemTypes.list();

    const contentfulTypeApiKeys = new Set(
      ctx.contentTypes.map((c: ContentTypeProps) => toItemTypeApiKey(c.sys.id)),
    );

    ctx.itemTypesToDestroy = ctx.datoItemTypes.filter((iT) =>
      contentfulTypeApiKeys.has(iT.api_key),
    );

    if (!this.autoconfirm && ctx.itemTypesToDestroy.length > 0) {
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
    ]);
  }

  async removeValidations(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    const itemTypesToDestroyIds = ctx.itemTypesToDestroy.map((i) => i.id);

    await this.runConcurrentlyOver(
      task,
      removeValidationsLog,
      ctx.datoItemTypes,
      (itemType) => `Model ${itemType.id}`,
      async (itemType) => {
        const typeLinksField = (
          await this.client.fields.list(itemType.id)
        ).filter((f) =>
          ['link', 'links', 'structured_text'].includes(f.field_type),
        );

        for (const field of typeLinksField) {
          switch (field.field_type) {
            case 'link': {
              const allowedItemTypes =
                field.validators.item_item_type.item_types;
              if (!allowedItemTypes) continue;

              const newAllowedItemTypes = allowedItemTypes.filter(
                (id) => !itemTypesToDestroyIds.includes(id),
              );

              if (newAllowedItemTypes.length !== allowedItemTypes.length) {
                await this.client.fields.update(field.id, {
                  validators: {
                    ...field.validators,
                    item_item_type: {
                      item_types: newAllowedItemTypes,
                    },
                  },
                });
              }
              break;
            }
            case 'links': {
              const allowedItemTypes =
                field.validators.items_item_type.item_types;
              if (!allowedItemTypes) continue;

              const newAllowedItemTypes = allowedItemTypes.filter(
                (id) => !itemTypesToDestroyIds.includes(id),
              );

              if (newAllowedItemTypes.length !== allowedItemTypes.length) {
                await this.client.fields.update(field.id, {
                  validators: {
                    ...field.validators,
                    items_item_type: {
                      item_types: newAllowedItemTypes,
                    },
                  },
                });
              }
              break;
            }
            case 'structured_text': {
              const allowedItemTypes =
                field.validators.structured_text_links.item_types;
              if (!allowedItemTypes) continue;

              const newAllowedItemTypes = allowedItemTypes.filter(
                (id) => !itemTypesToDestroyIds.includes(id),
              );

              if (newAllowedItemTypes.length !== allowedItemTypes.length) {
                await this.client.fields.update(field.id, {
                  validators: {
                    ...field.validators,
                    structured_text_links: {
                      item_types: newAllowedItemTypes,
                    },
                  },
                });
              }
              break;
            }
            default:
              throw new Error('Missing field type. This should not happen');
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
      (itemType) => `Model ${itemType.id}`,
      async (itemType) => {
        await this.client.itemTypes.destroy(itemType);
      },
    );
  }
}

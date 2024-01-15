import { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import { Context } from '../commands/contentful/import';
import { toItemTypeApiKey } from '../utils/item-type-create-helpers';
import BaseStep from './base-step';

const importModelsLog = 'Import models from Contentful';

export default class ImportModels extends BaseStep {
  async task(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.contentTypeIdToDatoItemType = {};

    await this.runConcurrentlyOver(
      task,
      importModelsLog,
      ctx.contentTypes,
      (contentType) => `Import ${contentType.name} model`,
      async (contentType) => {
        const contKey = contentType.sys.id;
        const itemTypeApiKey = toItemTypeApiKey(contKey);

        const itemTypeAttributes = {
          api_key: itemTypeApiKey,
          name: contentType.name,
          modular_block: false,
          ordering_direction: null,
          ordering_field: null,
          singleton: false,
          sortable: false,
          tree: false,
          draft_mode_active: true,
          // Contentful has this option by default
          all_locales_required: false,
        };

        const itemType = await this.client.itemTypes.create(itemTypeAttributes);

        ctx.contentTypeIdToDatoItemType[contentType.sys.id] = itemType;
      },
    );
  }
}

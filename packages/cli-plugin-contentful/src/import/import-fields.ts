import type { CmaClient } from '@datocms/cli-utils';
import type { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import type { Context } from '../commands/contentful/import';
import {
  contentFieldTypeToDatoFieldType,
  findLinkedItemTypesFromContentField,
  findOrCreateStructuredTextAssetBlock,
  isMultipleLinksField,
  isSingleLinkField,
  isTitleField,
  toFieldApiKey,
} from '../utils/item-type-create-helpers';
import BaseStep from './base-step';

const createFieldsLog = 'Import fields';

export default class ImportFields extends BaseStep {
  async task(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.contentTypeIdToDatoFields = {};
    ctx.contentTypeIdToContentfulFields = {};

    if (!this.options.skipContent) {
      ctx.assetBlockId = await findOrCreateStructuredTextAssetBlock(
        this.client,
      );
    }

    await this.runConcurrentlyOver(
      task,
      createFieldsLog,
      ctx.contentTypes,
      (contentType) => `Import ${contentType.name} fields`,
      async (contentType) => {
        const contentTypeId = contentType.sys.id;
        const itemType = ctx.contentTypeIdToDatoItemType[contentTypeId];

        if (!itemType) {
          throw new Error('This should not happen');
        }

        ctx.contentTypeIdToDatoFields[contentTypeId] = {};
        ctx.contentTypeIdToContentfulFields[contentTypeId] = {};

        for (const contentfulField of contentType.fields) {
          const position = contentType.fields.indexOf(contentfulField);
          let validators: any = {};

          if (isSingleLinkField(contentfulField)) {
            validators = {
              item_item_type: {
                item_types: findLinkedItemTypesFromContentField(
                  ctx.contentTypeIdToDatoItemType,
                  contentfulField,
                ),
              },
            };
          }

          if (isMultipleLinksField(contentfulField)) {
            validators = {
              items_item_type: {
                item_types: findLinkedItemTypesFromContentField(
                  ctx.contentTypeIdToDatoItemType,
                  contentfulField,
                ),
              },
            };
          }

          if (contentfulField.type === 'RichText') {
            validators = {
              structured_text_blocks: {
                item_types: ctx.assetBlockId ? [ctx.assetBlockId] : [],
              },
              structured_text_links: {
                item_types: findLinkedItemTypesFromContentField(
                  ctx.contentTypeIdToDatoItemType,
                  contentfulField,
                ),
              },
            };
          }

          const fieldAttributes: CmaClient.ApiTypes.FieldCreateSchema = {
            label: contentfulField.name,
            field_type: contentFieldTypeToDatoFieldType(contentfulField) as any,
            localized: contentfulField.localized,
            api_key: toFieldApiKey(contentfulField.id),
            position,
            validators,
          };

          if (isTitleField(contentfulField, contentType)) {
            fieldAttributes.appearance = {
              editor: 'single_line',
              parameters: { heading: true },
              addons: [],
            };
          }

          const datoField = await this.client.fields.create(
            itemType.id,
            fieldAttributes,
          );

          ctx.contentTypeIdToDatoFields[contentTypeId][contentfulField.id] =
            datoField;

          ctx.contentTypeIdToContentfulFields[contentTypeId][
            contentfulField.id
          ] = contentfulField;
        }
      },
    );
  }
}

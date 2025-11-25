import type { ContentFields, KeyValueMap } from 'contentful-management';
import type { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import type { Context } from '../commands/contentful/import';
import contentfulFieldValidatorsToDato from '../utils/item-type-create-helpers';
import BaseStep from './base-step';

const AddValidationsLog = 'Add validations to fields';

export default class AddValidations extends BaseStep {
  async task(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    await this.runConcurrentlyOver(
      task,
      AddValidationsLog,
      Object.keys(ctx.contentTypeIdToContentfulFields),
      (contentfulContentTypeId) =>
        `Add validations to ${contentfulContentTypeId}`,
      async (contentfulContentTypeId) => {
        const contentTypeIdToContentfulFields =
          ctx.contentTypeIdToContentfulFields[contentfulContentTypeId];

        for (const [contentfulFieldId, contentfulField] of Object.entries(
          contentTypeIdToContentfulFields,
        )) {
          const datoField =
            ctx.contentTypeIdToDatoFields[contentfulContentTypeId][
              contentfulFieldId
            ];

          if (!datoField) {
            throw new Error('Missing field. This should not happen');
          }

          const newValidators = contentfulFieldValidatorsToDato(
            contentfulField as ContentFields<KeyValueMap>,
            ctx.contentTypeIdToEditorInterface[contentfulContentTypeId],
            ctx.contentTypeIdToDatoFields[contentfulContentTypeId],
          );

          await this.client.fields.update(datoField.id, {
            validators: { ...datoField.validators, ...newValidators },
          });
        }
      },
    );
  }
}

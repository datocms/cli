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
      ctx.contentfulFields,
      (field) => `Add validations to ${field.id}`,
      async (contentfulField) => {
        const datoField = Object.values(ctx.contentTypeIdToDatoFields)
          .flat()
          .find((f) => f[contentfulField.id])?.[contentfulField.id];

        if (!datoField) {
          throw new Error('Missing field. This should not happen');
        }

        const newValidators = contentfulFieldValidatorsToDato(contentfulField);

        await this.client.fields.update(datoField.id, {
          validators: { ...datoField.validators, ...newValidators },
        });
      },
    );
  }
}

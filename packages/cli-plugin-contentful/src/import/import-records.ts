import type { CmaClient } from '@datocms/cli-utils';
import type { Entry } from 'contentful-management';
import {
  Listr,
  type ListrRendererFactory,
  type ListrTaskWrapper,
} from 'listr2';
import type { Context } from '../commands/contentful/import';
import { getAll } from '../utils/getAll';
import {
  datoLinkValueForFieldType,
  datoValueForFieldType,
  isLinkType,
} from '../utils/item-create-helpers';
import BaseStep from './base-step';

const importRecordsLog = 'Import entries from Contentful';
const linkRecordsAndAssetsLog = 'Link records and assets';

type FieldValue =
  | {
      [locale: string]: unknown;
    }
  | null
  | unknown;

export default class ImportRecords extends BaseStep {
  async task(): Promise<Listr> {
    return new Listr<Context>([
      {
        title: importRecordsLog,
        task: this.createItems.bind(this),
      },
      {
        title: linkRecordsAndAssetsLog,
        task: this.linkRecordsAndAssets.bind(this),
        options: { persistentOutput: true },
      },
    ]);
  }

  async createItems(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.entriesWithLinkField = [];
    ctx.entryIdToDatoItem = {};

    const rawEntries = await getAll(
      this.cfEnvironmentApi.getEntries.bind(this.cfEnvironmentApi),
    );

    const contentfulEntries = this.options.importOnly
      ? rawEntries.filter((entry) =>
          this.options.importOnly?.includes(entry.sys.contentType.sys.id),
        )
      : rawEntries;

    if (contentfulEntries.length === 0) {
      task.skip('No entries to import');
      return;
    }

    await this.runConcurrentlyOver(
      task,
      importRecordsLog,
      contentfulEntries,
      (entry) => `Import ${entry.sys.id}`,
      async (entry) => {
        const {
          contentType,
          publishedVersion,
          id: entryId,
          createdAt,
          firstPublishedAt,
        } = entry.sys;

        const contentfulFieldTodatoField =
          ctx.contentTypeIdToDatoFields[contentType.sys.id];

        const recordAttributes: Partial<CmaClient.ApiTypes.ItemCreateSchema> =
          {};

        let hasLinks = false;

        for (const [contentfulFieldApiKey, datoField] of Object.entries(
          contentfulFieldTodatoField,
        )) {
          const contentfulContent = entry.fields[contentfulFieldApiKey];

          if (!datoField) {
            throw new Error('Missing field, This should not happen!');
          }

          let fieldValue: FieldValue = null;

          if (datoField.localized) {
            fieldValue = {};

            for (const locale of ctx.locales) {
              (fieldValue as Record<string, unknown>)[locale] =
                contentfulContent?.[locale]
                  ? await datoValueForFieldType(
                      contentfulContent[locale],
                      datoField.field_type,
                      ctx.uploadUrlToDatoUploadUrl,
                    )
                  : null;
            }
          } else {
            fieldValue = contentfulContent?.[ctx.defaultLocale]
              ? await datoValueForFieldType(
                  contentfulContent[ctx.defaultLocale],
                  datoField.field_type,
                  ctx.uploadUrlToDatoUploadUrl,
                )
              : null;
          }

          if (isLinkType(datoField.field_type)) {
            hasLinks = true;
          }

          recordAttributes[datoField.api_key] = fieldValue;
        }

        const itemType = ctx.contentTypeIdToDatoItemType[contentType.sys.id];

        if (!itemType) {
          throw new Error(
            "This record's model has no fields. This should not happen",
          );
        }

        const record = await this.client.items.create({
          item_type: {
            type: 'item_type',
            id: itemType.id,
          },
          meta: {
            created_at: createdAt,
            first_published_at: firstPublishedAt,
          },
          ...recordAttributes,
        });

        if (publishedVersion) {
          this.client.items.publish(record.id);
        }

        if (hasLinks) {
          ctx.entriesWithLinkField = [...ctx.entriesWithLinkField, entry];
        }

        ctx.entryIdToDatoItem[entryId] = record;
      },
    );
  }

  async linkRecordsAndAssets(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    await this.runConcurrentlyOver(
      task,
      linkRecordsAndAssetsLog,
      ctx.entriesWithLinkField,
      (entry) => `Create links for item ${entry.sys.id}`,
      async (entry: Entry, notify) => {
        const { contentType, publishedVersion, id } = entry.sys;

        // contentTypeIdToDatoFields = { [contentTypeId]: { [contentfulFieldId]: Field }> }
        const contentTypeFields =
          ctx.contentTypeIdToDatoFields[contentType.sys.id];

        if (!contentTypeFields) {
          throw new Error('This should not happen');
        }

        const newRecordAttributes: Partial<CmaClient.ApiTypes.ItemCreateSchema> =
          {};

        for (const [contentfulFieldApiKey, datoField] of Object.entries(
          contentTypeFields,
        )) {
          if (!datoField) {
            throw new Error('This should not happen');
          }

          const contentfulContent = entry.fields[contentfulFieldApiKey];

          if (!(contentfulContent && isLinkType(datoField.field_type))) {
            // Do not update this field
            continue;
          }

          let fieldValue: FieldValue = {};

          if (datoField.localized) {
            for (const locale of ctx.locales) {
              (fieldValue as Record<string, unknown>)[locale] =
                await datoLinkValueForFieldType({
                  contentfulValue: contentfulContent[locale],
                  datoFieldType: datoField.field_type,
                  entryIdToDatoItem: ctx.entryIdToDatoItem,
                  uploadIdToDatoUploadInfo: ctx.uploadIdToDatoUploadInfo,
                  assetBlockId: ctx.assetBlockId,
                  contentfulField:
                    ctx.contentTypeIdToContentfulFields[contentType.sys.id][
                      contentfulFieldApiKey
                    ],
                  contentTypeIdToDatoItemType: ctx.contentTypeIdToDatoItemType,
                });
            }
          } else {
            fieldValue = await datoLinkValueForFieldType({
              contentfulValue: contentfulContent[ctx.defaultLocale],
              datoFieldType: datoField.field_type,
              entryIdToDatoItem: ctx.entryIdToDatoItem,
              uploadIdToDatoUploadInfo: ctx.uploadIdToDatoUploadInfo,
              assetBlockId: ctx.assetBlockId,
              contentfulField:
                ctx.contentTypeIdToContentfulFields[contentType.sys.id][
                  contentfulFieldApiKey
                ],
              contentTypeIdToDatoItemType: ctx.contentTypeIdToDatoItemType,
            });
          }

          newRecordAttributes[datoField.api_key] = fieldValue;
        }

        const datoItemId = ctx.entryIdToDatoItem[id];
        await this.client.items.update(datoItemId, newRecordAttributes);

        if (publishedVersion) {
          try {
            notify(`Publish ${datoItemId}...`);
            await this.client.items.publish(datoItemId);
            notify('Done!');
          } catch {
            notify(
              `Cannot publish record: ${datoItemId}. Contentful allows published records with draft links while DatoCMS doesn't.`,
            );
          }
        }
      },
    );
  }
}

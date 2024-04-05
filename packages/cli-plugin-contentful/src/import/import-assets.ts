import type { CmaClient } from '@datocms/cli-utils';
import type { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import type { Context } from '../commands/contentful/import';
import { getAll } from '../utils/getAll';
import BaseStep from './base-step';

const createAssetsLog = 'Import assets from Contentful';

export default class ImportAssets extends BaseStep {
  async task(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.uploadIdToDatoUploadInfo = {};
    ctx.uploadUrlToDatoUploadUrl = {};

    const contentfulAssets = await getAll(
      this.cfEnvironmentApi.getAssets.bind(this.cfEnvironmentApi),
    );

    await this.runConcurrentlyOver(
      task,
      createAssetsLog,
      contentfulAssets,
      (contentfulAsset) =>
        `Asset ${
          contentfulAsset.fields.file?.[ctx.defaultLocale]?.fileName ||
          contentfulAsset.sys.id
        }`,
      async (contentfulAsset, notify) => {
        const fileUrl = contentfulAsset.fields.file?.[ctx.defaultLocale]?.url;

        if (!fileUrl) {
          notify(`missing URL in upload ${contentfulAsset.sys.id}, skip`);
          return;
        }

        try {
          const fileMetadata = ctx.locales.reduce(
            (
              acc: NonNullable<
                CmaClient.SimpleSchemaTypes.UploadCreateSchema['default_field_metadata']
              >,
              locale: string,
            ) => {
              acc[locale] = {
                title: contentfulAsset.fields.title?.[locale] || null,
                alt: contentfulAsset.fields.description?.[locale] || null,
                custom_data: {},
              };

              return acc;
            },
            {},
          );

          const upload = await this.client.uploads.createFromUrl({
            url: `https:${fileUrl}`,
            skipCreationIfAlreadyExists: true,
            onProgress: (info) => {
              notify(
                `${info.type} ${
                  'payload' in info && 'progress' in info.payload
                    ? ` (${info.payload.progress}%)`
                    : ''
                }`,
              );
            },
            default_field_metadata: fileMetadata,
          });

          ctx.uploadIdToDatoUploadInfo[contentfulAsset.sys.id] = {
            id: upload.id,
            url: upload.url,
          };
          ctx.uploadUrlToDatoUploadUrl[fileUrl] = upload.url;
        } catch (_e) {
          ctx.uploadIdToDatoUploadInfo[contentfulAsset.sys.id] = null;
          ctx.uploadUrlToDatoUploadUrl[fileUrl] = '';
        }
      },
    );
  }
}

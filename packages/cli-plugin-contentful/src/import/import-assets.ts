import BaseStep from './base-step';
import { Context } from '../commands/contentful/import';
import { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import { CmaClient } from '@datocms/cli-utils';

const createAssetsLog = 'Import assets from Contentful';

export default class ImportAssets extends BaseStep {
  async task(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.uploadIdToDatoUploadInfo = {};
    ctx.uploadUrlToDatoUploadUrl = {};

    const contentfulAssets = await this.cfEnvironmentApi.getAssets();

    await this.runConcurrentlyOver(
      task,
      createAssetsLog,
      contentfulAssets.items,
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

        const fileMetadata = ctx.locales.reduce(
          (
            // eslint-disable-next-line default-param-last
            acc: CmaClient.SimpleSchemaTypes.UploadCreateSchema['default_field_metadata'] = {},
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
      },
    );
  }
}

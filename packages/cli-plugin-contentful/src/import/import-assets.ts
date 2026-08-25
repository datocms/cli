import type { CmaClient } from '@datocms/cli-utils';
import { fetch } from '@whatwg-node/fetch';
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
        `Asset ${contentfulAsset.sys.id} ${
          contentfulAsset.fields.file?.[ctx.defaultLocale]?.url
            ? ` (https://${
                contentfulAsset.fields.file?.[ctx.defaultLocale]?.url
              })`
            : ''
        }`,
      async (contentfulAsset, notify) => {
        const fileUrl = contentfulAsset.fields.file?.[ctx.defaultLocale]?.url;

        if (!fileUrl) {
          notify(`missing URL in upload ${contentfulAsset.sys.id}, skip`);
          return;
        }

        try {
          // `default_field_metadata` is keyed by field and then by locale
          // (`{ alt: { en } }`), not by locale and then by field
          // (`{ en: { alt } }`). The API rejects the latter outright —
          // `422 INVALID_FORMAT: "en" is not a permitted key`.
          const fileMetadata: CmaClient.ApiTypes.UploadCreateSchema['default_field_metadata'] =
            {
              title: {},
              alt: {},
              custom_data: {},
            };

          for (const locale of ctx.locales) {
            fileMetadata!.title![locale] =
              contentfulAsset.fields.title?.[locale] || null;
            fileMetadata!.alt![locale] =
              contentfulAsset.fields.description?.[locale] || null;
            fileMetadata!.custom_data![locale] = {};
          }

          const client = this.client;

          async function findUploadUsingContenfulEtagOrCreateNew() {
            const fullUrl = `https:${fileUrl}`;

            const headResponse = await fetch(fullUrl, {
              method: 'HEAD',
              redirect: 'follow',
            });

            const etag = headResponse.headers.get('etag');
            if (etag) {
              const md5 = etag.trim().replace(/"/g, '');

              if (!md5.includes('-')) {
                const existingUploads = await client.uploads.list({
                  filter: { fields: { md5: { eq: md5 } } },
                });

                if (existingUploads.length === 1) {
                  return existingUploads[0];
                }
              }
            }

            return await client.uploads.createFromUrl({
              url: fullUrl,
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
          }

          const upload = await findUploadUsingContenfulEtagOrCreateNew();

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

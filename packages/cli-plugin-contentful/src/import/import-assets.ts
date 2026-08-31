import type { CmaClient } from '@datocms/cli-utils';
import { fetch } from '@whatwg-node/fetch';
import type { ListrRendererFactory, ListrTaskWrapper } from 'listr2';
import type { Context } from '../commands/contentful/import';
import { getAll } from '../utils/getAll';
import BaseStep from './base-step';

const createAssetsLog = 'Import assets from Contentful';

/**
 * The locale-indexed part of an asset's `default_field_metadata` — everything
 * but `focal_point` and `poster_time`, which this importer doesn't set — with
 * the three members required, so they can be filled in a loop.
 */
type LocalizedDefaultFieldMetadata = Required<
  Pick<
    NonNullable<
      CmaClient.ApiTypes.UploadCreateSchema['default_field_metadata']
    >,
    'alt' | 'title' | 'custom_data'
  >
>;

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
          // Field-keyed (`{ alt: { en } }`), which is what the types describe.
          // Environments that still speak the locale-keyed shape are
          // `uploads.createFromUrl`'s problem, not ours: the simple methods
          // convert in both directions.
          const fileMetadata: LocalizedDefaultFieldMetadata = {
            title: {},
            alt: {},
            custom_data: {},
          };

          for (const locale of ctx.locales) {
            fileMetadata.title[locale] =
              contentfulAsset.fields.title?.[locale] || null;
            fileMetadata.alt[locale] =
              contentfulAsset.fields.description?.[locale] || null;
            fileMetadata.custom_data[locale] = {};
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

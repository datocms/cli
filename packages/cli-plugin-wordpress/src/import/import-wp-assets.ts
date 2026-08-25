import type { CmaClient } from '@datocms/cli-utils';
import {
  Listr,
  type ListrRendererFactory,
  type ListrTaskWrapper,
} from 'listr2';
import type { Context } from '../commands/wordpress/import';
import BaseStep from './base-step';

const retrieveTitle = 'Retrieve assets from WordPress';
const createTitle = 'Upload assets to DatoCMS';
export default class WpAssets extends BaseStep {
  task(): Listr {
    return new Listr<Context>([
      {
        title: retrieveTitle,
        task: this.retrieveAssetsCatalog.bind(this),
      },
      {
        title: createTitle,
        task: this.uploadAssetsToDatoCms.bind(this),
      },
    ]);
  }

  async retrieveAssetsCatalog(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    ctx.wpMediaItems = await this.fetchAllWpPages(
      task,
      retrieveTitle,
      this.wpClient.media(),
    );
  }

  async uploadAssetsToDatoCms(
    ctx: Context,
    task: ListrTaskWrapper<Context, ListrRendererFactory>,
  ): Promise<void> {
    if (!ctx.wpMediaItems) {
      throw new Error('This should not happen');
    }

    const wpAssetIdToDatoId: Record<string, string> = {};
    const wpAssetUrlToDatoUrl: Record<string, string> = {};

    await this.runConcurrentlyOver(
      task,
      createTitle,
      ctx.wpMediaItems,
      (wpMediaItem) => wpMediaItem.source_url,
      async (wpMediaItem, notify) => {
        // `default_field_metadata` is keyed by field and then by locale
        // (`{ alt: { en } }`), not by locale and then by field
        // (`{ en: { alt } }`). The API rejects the latter outright —
        // `422 INVALID_FORMAT: "en" is not a permitted key` — so this is not a
        // matter of which shape is preferred. See the same note in the
        // Contentful importer.
        const defaultFieldMetadata: CmaClient.ApiTypes.UploadCreateSchema['default_field_metadata'] =
          {
            title: { en: wpMediaItem.title.rendered },
            alt: { en: wpMediaItem.alt_text },
            custom_data: { en: {} },
          };

        const upload = await this.client.uploads.createFromUrl({
          url: wpMediaItem.source_url,
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
          default_field_metadata: defaultFieldMetadata,
        });

        wpAssetIdToDatoId[wpMediaItem.id] = upload.id;
        wpAssetUrlToDatoUrl[wpMediaItem.source_url] = upload.url;

        if (wpMediaItem.media_details?.sizes) {
          for (const thumbName of Object.keys(
            wpMediaItem.media_details.sizes,
          )) {
            const {
              width,
              height,
              source_url: sourceUrl,
            } = wpMediaItem.media_details.sizes[thumbName];

            wpAssetUrlToDatoUrl[sourceUrl] =
              `${upload.url}?w=${width}&h=${height}&fit=crop`;
          }
        }
      },
    );

    ctx.wpAssetIdToDatoId = wpAssetIdToDatoId;
    ctx.wpAssetUrlToDatoUrl = wpAssetUrlToDatoUrl;
  }
}

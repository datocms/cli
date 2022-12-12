import { Listr, ListrTaskWrapper, ListrRendererFactory } from 'listr2';
import BaseStep from './base-step';
import { Context } from '../commands/wordpress/import';

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
          default_field_metadata: {
            en: {
              title: wpMediaItem.title.rendered,
              alt: wpMediaItem.alt_text,
              custom_data: {},
            },
          },
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

            wpAssetUrlToDatoUrl[
              sourceUrl
            ] = `${upload.url}?w=${width}&h=${height}&fit=crop`;
          }
        }
      },
    );

    ctx.wpAssetIdToDatoId = wpAssetIdToDatoId;
    ctx.wpAssetUrlToDatoUrl = wpAssetUrlToDatoUrl;
  }
}

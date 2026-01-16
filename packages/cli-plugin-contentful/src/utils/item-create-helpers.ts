import type { CmaClient } from '@datocms/cli-utils';
import type {
  ContentFields,
  Link as ContentfulLink,
} from 'contentful-management';
import {
  ContentfulRichTextTypes,
  type Handler,
  liftAssets,
  makeHandler,
  richTextToStructuredText as rawRichTextToStructuredText,
  visitChildren,
  wrapInParagraph,
} from 'datocms-contentful-to-structured-text';
import {
  type Block,
  type Link,
  type Node,
  type Document as StructuredTextDocument,
  allowedChildren,
  linkNodeType,
} from 'datocms-structured-text-utils';
import { compact } from 'lodash';
import type { Context } from '../commands/contentful/import';
import {
  findLinksFromContentMultipleLinksField,
  findLinksFromContentRichTextField,
  findLinksFromContentSingleLinkField,
} from './item-type-create-helpers';

export const isLinkType = (datoFieldType: string): boolean => {
  return ['file', 'gallery', 'link', 'links', 'structured_text'].includes(
    datoFieldType,
  );
};

export const datoValueForFieldType = async (
  contentfulValue: unknown,
  fieldType: CmaClient.ApiTypes.Field['field_type'],
  uploadUrlToDatoUploadUrl: Context['uploadUrlToDatoUploadUrl'],
): Promise<unknown> => {
  // Fills link and media fields temporarly. They will be valorized once we create all items
  if (['links', 'gallery'].includes(fieldType)) {
    return [];
  }

  if (['link', 'file'].includes(fieldType)) {
    return null;
  }

  if (fieldType === 'structured_text') {
    return null;
  }

  if (fieldType === 'text') {
    return Object.entries(uploadUrlToDatoUploadUrl).reduce(
      (acc, [contentfulUploadUrl, datoUploadUrl]) =>
        acc.replace(contentfulUploadUrl, datoUploadUrl),
      contentfulValue as string,
    );
  }

  if (fieldType === 'lat_lon') {
    const latLonValue = contentfulValue as { lat: string; lon: string };

    return (
      latLonValue && {
        latitude: latLonValue.lat,
        longitude: latLonValue.lon,
      }
    );
  }

  if (fieldType === 'string' && Array.isArray(contentfulValue)) {
    return contentfulValue?.join(', ');
  }

  if (fieldType === 'json') {
    return contentfulValue && JSON.stringify(contentfulValue, null, 2);
  }

  return contentfulValue;
};

export type UploadData = {
  upload_id: CmaClient.ApiTypes.UploadIdentity;
  alt: string | null;
  title: string | null;
  focal_point?: string;
  custom_data: Record<string, string>;
};
type LinkData = CmaClient.ApiTypes.ItemIdentity;

export const datoLinkValueForFieldType = async ({
  contentfulValue,
  datoFieldType,
  entryIdToDatoItem,
  uploadIdToDatoUploadInfo,
  assetBlockId,
  contentfulField,
  contentTypeIdToDatoItemType,
}: {
  contentfulValue: unknown;
  datoFieldType: CmaClient.ApiTypes.Field['field_type'];
  entryIdToDatoItem: Context['entryIdToDatoItem'];
  uploadIdToDatoUploadInfo: Context['uploadIdToDatoUploadInfo'];
  assetBlockId: string;
  contentfulField: ContentFields;
  contentTypeIdToDatoItemType: Context['contentTypeIdToDatoItemType'];
}): Promise<
  | UploadData
  | UploadData[]
  | LinkData
  | LinkData[]
  | StructuredTextDocument
  | null
> => {
  if (!contentfulValue) {
    return null;
  }

  if (datoFieldType === 'file') {
    const contentfulUploadValue = contentfulValue as ContentfulLink<'Asset'>;
    const datoUpload = uploadIdToDatoUploadInfo[contentfulUploadValue.sys.id];

    return datoUpload
      ? {
          upload_id: datoUpload.id,
          alt: null,
          title: null,
          custom_data: {},
        }
      : null;
  }

  if (datoFieldType === 'gallery') {
    const contentfulUploadValue = contentfulValue as ContentfulLink<'Asset'>[];

    const uploadData = contentfulUploadValue.map((link) => {
      const datoUpload = uploadIdToDatoUploadInfo[link.sys.id];
      return datoUpload
        ? {
            upload_id: datoUpload.id,
            alt: null,
            title: null,
            custom_data: {},
          }
        : null;
    });

    return uploadData.filter((b) => Boolean(b)) as UploadData[];
  }

  if (datoFieldType === 'link') {
    const allowedLinkedModels = findLinksFromContentSingleLinkField(
      contentTypeIdToDatoItemType,
      contentfulField,
    );

    const entryToLink = contentfulValue as ContentfulLink<'Entry'>;

    const datoItem = entryIdToDatoItem[entryToLink.sys.id];

    return datoItem && allowedLinkedModels.includes(datoItem.item_type.id)
      ? datoItem.id
      : null;
  }

  if (datoFieldType === 'links') {
    const allowedLinkedModels = findLinksFromContentMultipleLinksField(
      contentTypeIdToDatoItemType,
      contentfulField,
    );

    const entryToLink = contentfulValue as ContentfulLink<'Entry'>[];

    return compact(
      entryToLink.map((entry) => {
        const datoItem = entryIdToDatoItem[entry.sys.id];

        return datoItem && allowedLinkedModels.includes(datoItem.item_type.id)
          ? datoItem.id
          : null;
      }),
    );
  }

  if (datoFieldType === 'structured_text') {
    const handlers = generateStructuredTextHandlers({
      entryIdToDatoItem,
      uploadIdToDatoUploadInfo,
      assetBlockId,
      contentTypeIdToDatoItemType,
      contentfulField,
    });

    const richTextContent = contentfulValue as ContentfulRichTextTypes.Document;

    liftAssets(richTextContent);

    return rawRichTextToStructuredText(richTextContent, { handlers });
  }

  throw new Error('This should not happen');
};

const generateStructuredTextHandlers = ({
  entryIdToDatoItem,
  uploadIdToDatoUploadInfo,
  assetBlockId,
  contentTypeIdToDatoItemType,
  contentfulField,
}: {
  entryIdToDatoItem: Context['entryIdToDatoItem'];
  uploadIdToDatoUploadInfo: Context['uploadIdToDatoUploadInfo'];
  assetBlockId: string;
  contentTypeIdToDatoItemType: Context['contentTypeIdToDatoItemType'];
  contentfulField: ContentFields;
}): Handler[] => {
  return [
    makeHandler(
      (n): n is ContentfulRichTextTypes.EntryLinkInline =>
        n.nodeType === ContentfulRichTextTypes.INLINES.EMBEDDED_ENTRY,
      async (node, context) => {
        const isAllowedAsChild =
          allowedChildren[context.parentNodeType] === 'inlineNodes' ||
          allowedChildren[context.parentNodeType].includes('inlineItem');

        const contentfulId = node.data.target.sys.id;
        const allowedLinkedModels = findLinksFromContentRichTextField(
          contentTypeIdToDatoItemType,
          contentfulField,
        );

        const datoItem = entryIdToDatoItem[contentfulId];

        if (!datoItem || !allowedLinkedModels.includes(datoItem.item_type.id)) {
          return;
        }

        return isAllowedAsChild && datoItem.id
          ? { type: 'inlineItem', item: datoItem.id }
          : {
              type: 'span',
              value: `** Contentful inline embedded entry missing or inaccessible: ${contentfulId} **`,
            };
      },
    ),
    makeHandler(
      (n): n is ContentfulRichTextTypes.EntryLinkBlock =>
        n.nodeType === ContentfulRichTextTypes.BLOCKS.EMBEDDED_ENTRY,
      async (node, context) => {
        const contentfulId = node.data.target.sys.id;

        const allowedLinkedModels = findLinksFromContentRichTextField(
          contentTypeIdToDatoItemType,
          contentfulField,
        );

        const datoItem = entryIdToDatoItem[contentfulId];
        if (!datoItem) {
          return {
            type: 'span',
            value: `** Contentful embedded block missing or inaccessible: ${contentfulId} **`,
          };
        }

        if (!allowedLinkedModels.includes(datoItem.item_type.id)) {
          return;
        }

        // to do: EntryLinkBlock allows children, while we do not take that into consideration like
        // we do with assets and liftAsset
        const isAllowedAsChild =
          allowedChildren[context.parentNodeType] === 'inlineNodes' ||
          allowedChildren[context.parentNodeType].includes('inlineItem');

        // Contentful embedded-entry-block can be child of document, but not on Dato
        return isAllowedAsChild
          ? { type: 'inlineItem', item: datoItem.id }
          : wrapInParagraph([{ type: 'inlineItem', item: datoItem.id }]);
      },
    ),
    makeHandler(
      (n): n is ContentfulRichTextTypes.EntryHyperlink =>
        n.nodeType === ContentfulRichTextTypes.INLINES.ENTRY_HYPERLINK,
      async (node, context) => {
        const isAllowedChild =
          allowedChildren[context.parentNodeType] === 'inlineNodes';

        const children = await visitChildren(node, {
          ...context,
          parentNodeType: isAllowedChild ? 'itemLink' : context.parentNodeType,
        });

        const datoItemId = entryIdToDatoItem[node.data.target.sys.id]?.id;

        return isAllowedChild && datoItemId
          ? ({ type: 'itemLink', item: datoItemId, children } as Node)
          : children;
      },
    ),
    makeHandler(
      (n): n is ContentfulRichTextTypes.AssetHyperlink =>
        n.nodeType === ContentfulRichTextTypes.INLINES.ASSET_HYPERLINK,
      async (node, context) => {
        if (!uploadIdToDatoUploadInfo[node.data.target.sys.id]) {
          return;
        }

        const isAllowedAsChild =
          allowedChildren[context.parentNodeType] === 'inlineNodes' ||
          allowedChildren[context.parentNodeType].includes('inlineItem');

        if (!isAllowedAsChild) {
          return visitChildren(node, {
            ...context,
            parentNodeType: context.parentNodeType,
          });
        }

        const children = await visitChildren(node, {
          ...context,
          parentNodeType: linkNodeType,
        });

        const uploadUrl =
          uploadIdToDatoUploadInfo[node.data.target.sys.id]?.url || '';

        return {
          type: linkNodeType,
          url: uploadUrl,
          children,
        } as Link;
      },
    ),
    makeHandler(
      (n): n is ContentfulRichTextTypes.AssetLinkBlock =>
        n.nodeType === ContentfulRichTextTypes.BLOCKS.EMBEDDED_ASSET,
      async (node, context) => {
        const uploadId = uploadIdToDatoUploadInfo[node.data.target.sys.id]?.id;

        if (!uploadId) {
          return {
            type: 'span',
            value: `** Contentful asset inaccessible: #${node.data.target.sys.id} **`,
          };
        }

        const isAllowedAsChild =
          allowedChildren[context.parentNodeType].includes('block');

        if (!isAllowedAsChild) {
          return;
        }

        const itemPayload = {
          type: 'item',
          attributes: {
            file: uploadId ? { upload_id: uploadId } : null,
          },
          relationships: {
            item_type: {
              data: {
                id: assetBlockId,
                type: 'item_type',
              },
            },
          },
        };

        return {
          type: 'block',
          // At the moment the block type accepts only the ID of the block as a string, it doesn't take creating a new block into consideration.
          item: itemPayload as unknown as string,
        } as Block;
      },
    ),
  ];
};

import type { CmaClient } from '@datocms/cli-utils';
import { titleize } from 'inflected';

export async function createSlugField(
  client: CmaClient.Client,
  itemType: CmaClient.ApiTypes.ItemType,
  titleFieldId: string,
): Promise<CmaClient.ApiTypes.Field> {
  return client.fields.create(itemType.id, {
    field_type: 'slug',
    api_key: 'slug',
    label: 'Slug',
    validators: { slug_title_field: { title_field_id: titleFieldId } },
  });
}

export async function createStringField(
  client: CmaClient.Client,
  itemType: CmaClient.ApiTypes.ItemType,
  apiKey: string,
): Promise<CmaClient.ApiTypes.Field> {
  return client.fields.create(itemType.id, {
    field_type: 'string',
    api_key: apiKey,
    label: titleize(apiKey),
  });
}

export async function createTextField(
  client: CmaClient.Client,
  itemType: CmaClient.ApiTypes.ItemType,
  apiKey: string,
): Promise<CmaClient.ApiTypes.Field> {
  return client.fields.create(itemType.id, {
    api_key: apiKey,
    label: titleize(apiKey),
    field_type: 'text',
    appearance: {
      editor: 'wysiwyg',
      parameters: {
        toolbar: [
          'format',
          'bold',
          'italic',
          'strikethrough',
          'ordered_list',
          'unordered_list',
          'quote',
          'table',
          'link',
          'image',
          'show_source',
        ],
      },
      addons: [],
    },
  });
}

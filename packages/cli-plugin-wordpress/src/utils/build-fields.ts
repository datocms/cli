import { CmaClient } from '@datocms/cli-utils';
import { titleize } from 'inflected';

export async function createStringField(
  client: CmaClient.Client,
  itemType: CmaClient.SimpleSchemaTypes.ItemType,
  apiKey: string,
): Promise<void> {
  await client.fields.create(itemType.id, {
    field_type: 'string',
    api_key: apiKey,
    label: titleize(apiKey),
  });
}

export async function createTextField(
  client: CmaClient.Client,
  itemType: CmaClient.SimpleSchemaTypes.ItemType,
  apiKey: string,
): Promise<void> {
  await client.fields.create(itemType.id, {
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

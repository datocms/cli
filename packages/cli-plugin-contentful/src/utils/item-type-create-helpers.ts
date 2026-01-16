import type { CmaClient } from '@datocms/cli-utils';
import type {
  ContentFields,
  ContentTypeProps,
  EditorInterface,
} from 'contentful-management';
import { format } from 'date-fns';
import { decamelize } from 'humps';
import { compact, uniq } from 'lodash';
import type { Context } from '../commands/contentful/import';

const assetBlockFieldApiKey = 'file';
const assetBlockApiKey = 'structured_text_asset';

const reservedKeys: Set<string> = new Set([
  'position',
  'is_valid',
  'id',
  'type',
  'updated_at',
  'created_at',
  'attributes',
  'fields',
  'item_type',
  'is_singleton',
  'seo_meta_tags',
  'parent_id',
  'parent',
  'children',
  'status',
  'meta',
  'eq',
  'neq',
  'all_in',
  'any_in',
  'exists',
]);

export const toItemTypeApiKey = (value: string): string => {
  // Current acceptable values for item_types /[a-z](([a-z0-9]|_(?![_0-9]))*[a-z0-9])/

  return `${decamelize(value)
    .replace(/\W/g, '_')
    .replace(/^\d+/gm, 'n')
    .replace(/(^_+)|(_+)(\d+)|(_+)$/gm, '')}_model`.replace(/_{2,}/g, '_');
};

export const toFieldApiKey = (value: string): string => {
  const apiKey = decamelize(value);

  if (reservedKeys.has(apiKey)) {
    return `${apiKey}_field`;
  }

  return apiKey;
};

export function contentFieldTypeToDatoFieldType(
  field: ContentFields,
  editorInterface: EditorInterface,
): CmaClient.ApiTypes.FieldCreateSchema['field_type'] {
  switch (field.type) {
    case 'Symbol':
      if (isSlugField(field, editorInterface)) {
        return 'slug';
      }
      return 'string' as const;
    case 'Text':
      return 'text' as const;
    case 'Integer':
      return 'integer' as const;
    case 'Number':
      return 'float' as const;
    case 'Date':
      return 'date_time' as const;
    case 'Location':
      return 'lat_lon' as const;
    case 'Boolean':
      return 'boolean' as const;
    case 'Object':
      return 'json' as const;
    case 'RichText':
      return 'structured_text' as const;
    case 'Link':
      switch (field.linkType) {
        case 'Entry':
          return 'link' as const;
        case 'Asset':
          return 'file' as const;
        default:
          return 'string' as const;
      }

    case 'Array':
      switch (field.items?.linkType) {
        case 'Asset':
          return 'gallery' as const;
        case 'Entry':
          return 'links' as const;
        case 'Symbol':
          return 'string' as const;
        default:
          return 'string' as const;
      }

    default:
      return 'string' as const;
  }
}

export const findLinksFromContentMultipleLinksField = (
  contentTypeIdToDatoItemType: Context['contentTypeIdToDatoItemType'],
  contentfulField: ContentFields,
): string[] => {
  const linkValidation = contentfulField?.items?.validations?.find(
    (val) => val.linkContentType,
  );

  if (
    linkValidation?.linkContentType &&
    linkValidation?.linkContentType.length > 0
  ) {
    return compact(
      linkValidation.linkContentType.map(
        (contentTypeId) => contentTypeIdToDatoItemType[contentTypeId]?.id,
      ),
    );
  }

  return Object.values(contentTypeIdToDatoItemType).map(
    (iT: CmaClient.ApiTypes.ItemType) => iT.id,
  );
};

export const findLinksFromContentSingleLinkField = (
  contentTypeIdToDatoItemType: Context['contentTypeIdToDatoItemType'],
  contentfulField: ContentFields,
): string[] => {
  const linkValidation = contentfulField?.validations?.find(
    (val) => val.linkContentType,
  );

  if (
    linkValidation?.linkContentType &&
    linkValidation?.linkContentType.length > 0
  ) {
    return compact(
      linkValidation.linkContentType.map(
        (contentTypeId) => contentTypeIdToDatoItemType[contentTypeId]?.id,
      ),
    );
  }

  return Object.values(contentTypeIdToDatoItemType).map(
    (iT: CmaClient.ApiTypes.ItemType) => iT.id,
  );
};

export const findLinksFromContentRichTextField = (
  contentTypeIdToDatoItemType: Context['contentTypeIdToDatoItemType'],
  contentfulField: ContentFields,
): string[] => {
  const richTextValidation = contentfulField?.validations?.find(
    (val) => val.nodes,
  );

  let datoValidations: string[] = [];
  const embeddedEntries = richTextValidation?.nodes?.[
    'embedded-entry-block'
  ]?.find((node) => node.linkContentType)?.linkContentType;
  const inlineEntries = richTextValidation?.nodes?.[
    'embedded-entry-inline'
  ]?.find((node) => node.linkContentType)?.linkContentType;

  if (!embeddedEntries && !inlineEntries) {
    return Object.values(contentTypeIdToDatoItemType).map(
      (iT: CmaClient.ApiTypes.ItemType) => iT.id,
    );
  }

  if (embeddedEntries && embeddedEntries.length > 0) {
    datoValidations = embeddedEntries.map(
      (entryId) => contentTypeIdToDatoItemType[entryId]?.id,
    );
  }

  if (inlineEntries && inlineEntries.length > 0) {
    datoValidations = [
      ...datoValidations,
      ...inlineEntries.map(
        (entryId) => contentTypeIdToDatoItemType[entryId]?.id,
      ),
    ];
  }

  return uniq(compact(datoValidations));
};

export const findOrCreateStructuredTextAssetBlock = async (
  datoClient: CmaClient.Client,
): Promise<string> => {
  // DatoCMS does not handle assets in Structured Text like Contentful does, so
  // we need to create a modular block with a file field to allow assets in Structured text

  let contentfulAssetModularBlock: CmaClient.ApiTypes.ItemType;

  try {
    contentfulAssetModularBlock =
      await datoClient.itemTypes.find(assetBlockApiKey);
  } catch {
    contentfulAssetModularBlock = await datoClient.itemTypes.create({
      name: 'Structured Text asset',
      api_key: assetBlockApiKey,
      modular_block: true,
    });

    await datoClient.fields.create(contentfulAssetModularBlock.id, {
      label: 'File',
      api_key: assetBlockFieldApiKey,
      field_type: 'file',
    });
  }

  return contentfulAssetModularBlock.id;
};

export const getFieldControl = (
  field: ContentFields,
  editorInterface?: EditorInterface,
) => {
  return editorInterface?.controls?.find((c) => c.fieldId === field.id);
};

export const isMultipleLinksField = (
  field: ContentFields,
): boolean | undefined =>
  field.type === 'Array' &&
  field.items &&
  field.items.type === 'Link' &&
  field.items.linkType === 'Entry';

export const isSingleLinkField = (field: ContentFields): boolean | undefined =>
  field.type === 'Link' && field.linkType === 'Entry';

export const isTitleField = (
  field: ContentFields,
  contentType: ContentTypeProps,
): boolean | undefined =>
  field.id === contentType.displayField && field.type === 'Symbol';

export const isSlugField = (
  field: ContentFields,
  editorInterface?: EditorInterface,
): boolean | undefined => {
  const control = getFieldControl(field, editorInterface);
  return control?.widgetId === 'slugEditor';
};

type StringValidators = {
  required?: Record<string, never>;
  length?: {
    min?: number;
    max?: number;
    eq?: number;
  };
  unique?: Record<string, never>;
  enum?: {
    values: string[] | undefined;
  };
  format?: {
    custom_pattern: string | undefined;
  };
};

type SlugValidators = StringValidators & {
  slug_title_field?: { title_field_id: string };
};

type IntegerValidators = {
  required?: Record<string, never>;
  number_range?: {
    min?: number;
    max?: number;
  };
};

type DateValidators = {
  required?: Record<string, never>;
  date_time_range?: {
    min?: string | null;
    max?: string | null;
  };
};

type AssetValidators = {
  required?: Record<string, never>;
  file_size?: {
    min_value?: number;
    max_value?: number;
    min_unit?: 'B' | 'KB' | 'MB' | null;
    max_unit?: 'B' | 'KB' | 'MB' | null;
  };
};

type ArrayValidators = {
  required?: Record<string, never>;
  size?: {
    min?: number;
    max?: number;
    eq?: number;
  };
};

export default function contentfulFieldValidatorsToDato(
  field: ContentFields,
  editorInterface: EditorInterface,
  datoFields: { [key: ContentFields['id']]: CmaClient.ApiTypes.Field },
):
  | StringValidators
  | SlugValidators
  | IntegerValidators
  | DateValidators
  | ArrayValidators
  | AssetValidators {
  switch (field.type) {
    case 'Symbol':
      if (isSlugField(field, editorInterface)) {
        return datoValidatorsForSlug(field, editorInterface, datoFields);
      }
      return datoValidatorsForString(field);
    case 'Text':
      return datoValidatorsForString(field);
    case 'Date':
      return datoValidatorsForDate(field);
    case 'Integer':
    case 'Number':
      return datoValidatorsForNumber(field);
    case 'Link':
      switch (field.linkType) {
        case 'Asset':
          return datoValidatorsForAsset(field);
        default:
          return {};
      }

    case 'Array':
      switch (field.items?.linkType) {
        case 'Asset':
        case 'Entry':
          return datoValidatorsForArray(field);
        case 'Symbol':
          return datoValidatorsForString(field);
        default:
          return datoValidatorsForString(field);
      }
    default:
      return {};
  }
}

const datoValidatorsForString = (field: ContentFields) => {
  const datoValidators: StringValidators = {};

  if (field.required) {
    datoValidators.required = {};
  }

  if (!field.validations) {
    return datoValidators;
  }

  for (const validation of field.validations) {
    if (validation.size) {
      datoValidators.length = {};

      if (
        validation.size.min &&
        validation.size.max &&
        validation.size.min === validation.size.max
      ) {
        datoValidators.length.eq = validation.size.min;
      } else {
        if (validation.size?.min) {
          datoValidators.length.min = validation.size?.min;
        }

        if (validation.size?.max) {
          datoValidators.length.max = validation.size.max;
        }
      }
    }

    if ('unique' in validation) {
      datoValidators.unique = {};
    }

    if (validation.in) {
      datoValidators.enum = {
        values: validation.in?.map((v) => v.toString()),
      };
    }

    if (validation.regexp) {
      datoValidators.format = {
        custom_pattern: validation.regexp.pattern,
      };
    }
  }

  return datoValidators;
};

const datoValidatorsForSlug = (
  field: ContentFields,
  editorInterface: EditorInterface,
  datoFields: { [key: string]: CmaClient.ApiTypes.Field },
): SlugValidators => {
  const stringValidators = datoValidatorsForString(field);
  const control = getFieldControl(field, editorInterface);

  return {
    ...stringValidators,
    ...(control?.settings?.trackingFieldId &&
      datoFields[control.settings.trackingFieldId as string] && {
        slug_title_field: {
          title_field_id:
            datoFields[control.settings.trackingFieldId as string].id,
        },
      }),
  };
};

const datoValidatorsForNumber = (field: ContentFields) => {
  const datoValidators: IntegerValidators = {};

  if (field.required) {
    datoValidators.required = {};
  }

  if (!field.validations) {
    return datoValidators;
  }

  for (const validation of field.validations) {
    if ('range' in validation) {
      datoValidators.number_range = {};

      if (validation.range?.min) {
        datoValidators.number_range.min = validation.range.min;
      }

      if (validation.range?.max) {
        datoValidators.number_range.max = validation.range.max;
      }
    }
  }

  return datoValidators;
};

const datoValidatorsForDate = (field: ContentFields) => {
  const datoValidators: DateValidators = {};

  if (field.required) {
    datoValidators.required = {};
  }

  if (!field.validations) {
    return datoValidators;
  }

  for (const validation of field.validations) {
    if (validation.dateRange) {
      datoValidators.date_time_range = {
        min: validation.dateRange.min
          ? format(
              new Date(validation.dateRange.min),
              "yyyy-MM-dd'T'HH:mm:ssXXX",
            )
          : null,
        max: validation.dateRange.max
          ? format(
              new Date(validation.dateRange.max),
              "yyyy-MM-dd'T'HH:mm:ssXXX",
            )
          : null,
      };
    }
  }

  return datoValidators;
};

const datoValidatorsForAsset = (field: ContentFields) => {
  const datoValidators: AssetValidators = {};

  if (field.required) {
    datoValidators.required = {};
  }

  if (!field.validations) {
    return datoValidators;
  }

  for (const validation of field.validations) {
    if (
      validation.assetFileSize &&
      (validation.assetFileSize.min || validation.assetFileSize.max)
    ) {
      if (validation.assetFileSize.min) {
        datoValidators.file_size = {
          min_value: validation.assetFileSize.min,
          min_unit: 'B',
        };
      }

      if (validation.assetFileSize.max) {
        datoValidators.file_size = {
          ...datoValidators.file_size,
          max_value: validation.assetFileSize.max,
          max_unit: 'B',
        };
      }
    }
  }

  return datoValidators;
};

const datoValidatorsForArray = (field: ContentFields) => {
  const datoValidators: ArrayValidators = {};

  if (!field.validations) {
    return datoValidators;
  }

  for (const validation of field.validations) {
    if (validation.size) {
      datoValidators.size = {};

      if (
        validation.size.min &&
        validation.size.max &&
        validation.size.min === validation.size.max
      ) {
        datoValidators.size.eq = validation.size.min;
      } else {
        if (validation.size?.min) {
          datoValidators.size.min = validation.size?.min;
        }

        if (validation.size?.max) {
          datoValidators.size.max = validation.size.max;
        }
      }
    }
  }

  return datoValidators;
};

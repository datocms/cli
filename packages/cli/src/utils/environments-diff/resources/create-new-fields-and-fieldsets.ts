import { CmaClient } from '@datocms/cli-utils';
import {
  difference,
  intersection,
  isEqual,
  pick,
  sortBy,
  without,
} from 'lodash';
import { Command, ItemTypeInfo, Schema } from '../types';
import {
  buildFieldTitle,
  buildFieldsetTitle,
  buildItemTypeTitle,
  isBase64Id,
} from '../utils';
import { buildComment } from './comments';

function buildDefaultValues(
  site: CmaClient.SchemaTypes.Site,
): Partial<CmaClient.SchemaTypes.FieldAttributes> {
  return {
    hint: null,
    localized: false,
    deep_filtering_enabled: false,
    default_value:
      site.attributes.locales.length === 1
        ? null
        : Object.fromEntries(
            site.attributes.locales.map((locale) => [locale, null]),
          ),
    validators: {},
  };
}

export function buildCreateFieldClientCommand(
  site: CmaClient.SchemaTypes.Site,
  itemType: CmaClient.SchemaTypes.ItemType,
  field: CmaClient.SchemaTypes.Field,
): Command[] {
  const defaultValues = buildDefaultValues(site);

  const attributesToPick = without(
    (
      Object.keys(field.attributes) as Array<
        keyof CmaClient.SchemaTypes.FieldAttributes
      >
    ).filter(
      (attribute) =>
        !isEqual(defaultValues[attribute], field.attributes[attribute]),
    ),
    'appeareance',
  );

  const attributesToUpdate = pick(
    field.attributes,
    without(attributesToPick, 'position'),
  );

  return [
    buildComment(
      `Create ${buildFieldTitle(field)} in ${buildItemTypeTitle(itemType)}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.fields.create',
      arguments: [
        field.relationships.item_type.data.id,
        {
          data: {
            type: 'field',
            id: isBase64Id(field.id) ? field.id : undefined,
            attributes: attributesToUpdate,
            ...(field.relationships.fieldset.data
              ? { relationships: pick(field.relationships, 'fieldset') }
              : {}),
          },
        },
      ],
      oldEnvironmentId: field.id,
    },
  ];
}

const defaultValuesForFieldsetAttribute: Partial<CmaClient.SchemaTypes.FieldsetAttributes> =
  {
    hint: null,
    collapsible: false,
    start_collapsed: false,
  };

export function buildCreateFieldsetClientCommand(
  itemType: CmaClient.SchemaTypes.ItemType,
  fieldset: CmaClient.SchemaTypes.Fieldset,
): Command[] {
  const attributesToUpdate = pick(
    fieldset.attributes,
    without(
      (
        Object.keys(fieldset.attributes) as Array<
          keyof CmaClient.SchemaTypes.FieldsetAttributes
        >
      ).filter(
        (attribute) =>
          !isEqual(
            defaultValuesForFieldsetAttribute[attribute],
            fieldset.attributes[attribute],
          ),
      ),
      'position',
    ),
  );

  return [
    buildComment(
      `Create ${buildFieldsetTitle(fieldset)} in ${buildItemTypeTitle(
        itemType,
      )}`,
    ),
    {
      type: 'apiCallClientCommand',
      call: 'client.fieldsets.create',
      arguments: [
        fieldset.relationships.item_type.data.id,
        {
          data: {
            type: 'fieldset',
            id: isBase64Id(fieldset.id) ? fieldset.id : undefined,
            attributes: attributesToUpdate,
          },
        },
      ],
      oldEnvironmentId: fieldset.id,
    },
  ];
}

export function buildCreateFieldClientCommands(
  site: CmaClient.SchemaTypes.Site,
  itemType: CmaClient.SchemaTypes.ItemType,
  fields: CmaClient.SchemaTypes.Field[],
): Command[] {
  const nonSlugFields = sortBy(
    fields.filter((field) => field.attributes.field_type !== 'slug'),
    (e) => e.attributes.position,
  );

  const slugFields = sortBy(
    fields.filter((field) => field.attributes.field_type === 'slug'),
    (e) => e.attributes.position,
  );

  return [
    ...nonSlugFields.flatMap(
      buildCreateFieldClientCommand.bind(null, site, itemType),
    ),
    ...slugFields.flatMap(
      buildCreateFieldClientCommand.bind(null, site, itemType),
    ),
  ];
}

export function buildCreateFieldsetClientCommands(
  itemType: CmaClient.SchemaTypes.ItemType,
  fieldsets: CmaClient.SchemaTypes.Fieldset[],
): Command[] {
  return sortBy(fieldsets, (e) => e.attributes.position).flatMap(
    buildCreateFieldsetClientCommand.bind(null, itemType),
  );
}

function createNewFieldsAndFieldsetsInItemType(
  newSite: CmaClient.SchemaTypes.Site,
  newItemTypeSchema: ItemTypeInfo,
  oldItemTypeSchema?: ItemTypeInfo,
): Command[] {
  const oldFieldIds = oldItemTypeSchema
    ? Object.keys(oldItemTypeSchema.fieldsById)
    : null;

  const newFieldIds = Object.keys(newItemTypeSchema.fieldsById);

  const fieldsToCreate = (
    oldFieldIds ? difference(newFieldIds, oldFieldIds) : newFieldIds
  ).map((fieldId) => newItemTypeSchema.fieldsById[fieldId]);

  const oldFieldsetIds = oldItemTypeSchema
    ? Object.keys(oldItemTypeSchema.fieldsetsById)
    : null;

  const newFieldsetIds = Object.keys(newItemTypeSchema.fieldsetsById);

  const fieldsetsToCreate = (
    oldFieldsetIds ? difference(newFieldsetIds, oldFieldsetIds) : newFieldsetIds
  ).map((fieldsetId) => newItemTypeSchema.fieldsetsById[fieldsetId]);

  return [
    ...buildCreateFieldsetClientCommands(
      newItemTypeSchema.entity,
      fieldsetsToCreate,
    ),
    ...buildCreateFieldClientCommands(
      newSite,
      newItemTypeSchema.entity,
      fieldsToCreate,
    ),
  ];
}

export function createNewFieldsAndFieldsets(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const createdItemTypeIds = difference(newItemTypeIds, oldItemTypeIds);
  const keptItemTypeIds = intersection(newItemTypeIds, oldItemTypeIds);

  const commands = [...createdItemTypeIds, ...keptItemTypeIds].flatMap(
    (itemTypeId) =>
      createNewFieldsAndFieldsetsInItemType(
        newSchema.siteEntity,
        newSchema.itemTypesById[itemTypeId],
        oldSchema.itemTypesById[itemTypeId],
      ),
  );

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Creating new fields/fieldsets'), ...commands];
}

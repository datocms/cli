import type {
  ApiTypes,
  SchemaRepository as SchemaRepositoryClass,
} from '@datocms/cma-client-node';
import { fuzzyScore } from './fuzzyScore';

type ItemType = ApiTypes.ItemType;
type Field = ApiTypes.Field;
type Fieldset = ApiTypes.Fieldset;
type SchemaRepository = InstanceType<typeof SchemaRepositoryClass>;

export type SchemaFilterType = 'all' | 'models_only' | 'blocks_only';

export type FieldDetailsOption = 'validators' | 'appearance' | 'default_values';

export type FieldsDetails = 'basic' | 'complete' | FieldDetailsOption[];

export type SchemaInspectOptions = {
  filterByName?: string;
  filterByType?: SchemaFilterType;
  fieldsDetails?: FieldsDetails;
  includeFieldsets?: boolean;
  includeNestedBlocks?: boolean;
  includeReferencedModels?: boolean;
  includeEmbeddingModels?: boolean;
};

export type SchemaInfoResult = {
  itemType: Partial<ItemType>;
  fields: Partial<Field>[];
  fieldsets?: Omit<Fieldset, 'item_type'>[];
};

export async function collectSchemaInfo(
  repo: SchemaRepository,
  options: SchemaInspectOptions,
): Promise<SchemaInfoResult[]> {
  await repo.prefetchAllModelsAndFields();

  const itemTypes = await getFilteredItemTypes(repo, options);

  const results: SchemaInfoResult[] = [];
  const processedIds = new Set<string>();

  for (const itemType of itemTypes) {
    await processItemType(repo, itemType, options, results, processedIds);
  }

  if (options.includeNestedBlocks && itemTypes.length > 0) {
    const nestedBlocks = await repo.getNestedBlocks(itemTypes);
    for (const block of nestedBlocks) {
      if (!processedIds.has(block.id)) {
        await processItemType(repo, block, options, results, processedIds);
      }
    }
  }

  if (options.includeReferencedModels && itemTypes.length > 0) {
    const allItemTypes = [...itemTypes];
    if (options.includeNestedBlocks) {
      const nestedBlocks = await repo.getNestedBlocks(itemTypes);
      allItemTypes.push(...nestedBlocks);
    }

    const referencedModels = await repo.getNestedModels(allItemTypes);
    for (const model of referencedModels) {
      if (!processedIds.has(model.id)) {
        await processItemType(repo, model, options, results, processedIds);
      }
    }
  }

  if (options.includeEmbeddingModels && itemTypes.length > 0) {
    const blocks = itemTypes.filter((it) => it.modular_block);
    if (blocks.length > 0) {
      const embeddingModels = await repo.getModelsEmbeddingBlocks(blocks);
      for (const model of embeddingModels) {
        if (!processedIds.has(model.id)) {
          await processItemType(repo, model, options, results, processedIds);
        }
      }
    }
  }

  return results;
}

export async function getFilteredItemTypes(
  repo: SchemaRepository,
  options: Pick<SchemaInspectOptions, 'filterByName' | 'filterByType'>,
): Promise<ItemType[]> {
  let candidates: ItemType[];
  if (options.filterByType === 'models_only') {
    candidates = await repo.getAllModels();
  } else if (options.filterByType === 'blocks_only') {
    candidates = await repo.getAllBlockModels();
  } else {
    candidates = await repo.getAllItemTypes();
  }

  if (!options.filterByName) {
    return candidates;
  }

  const searchTerm = options.filterByName;

  const exactMatches = candidates.filter(
    (it) =>
      it.api_key === searchTerm ||
      it.id === searchTerm ||
      it.name === searchTerm,
  );

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return candidates
    .map((it) => ({
      item: it,
      score: Math.max(
        fuzzyScore(searchTerm, it.api_key),
        fuzzyScore(searchTerm, it.name),
      ),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.item);
}

async function processItemType(
  repo: SchemaRepository,
  itemType: ItemType,
  options: Pick<SchemaInspectOptions, 'fieldsDetails' | 'includeFieldsets'>,
  results: SchemaInfoResult[],
  processedIds: Set<string>,
): Promise<void> {
  if (processedIds.has(itemType.id)) return;
  processedIds.add(itemType.id);

  let fields = await repo.getItemTypeFields(itemType);

  const fieldsDetails = options.fieldsDetails ?? 'basic';
  if (fieldsDetails === 'basic') {
    fields = filterFieldDetails(fields, []);
  } else if (fieldsDetails !== 'complete') {
    fields = filterFieldDetails(fields, fieldsDetails);
  }

  const strippedFields = fields.map<Partial<Field>>((field) => {
    const {
      item_type: _itemType,
      deep_filtering_enabled: _deepFiltering,
      position,
      fieldset,
      ...rest
    } = field;

    if (options.includeFieldsets) {
      return { ...rest, position, fieldset };
    }

    return rest;
  });

  const {
    fields: _fields,
    fieldsets: _fieldsets,
    ...strippedItemType
  } = itemType;

  const result: SchemaInfoResult = {
    itemType: strippedItemType,
    fields: strippedFields,
  };

  if (options.includeFieldsets) {
    const fieldsets = await repo.getItemTypeFieldsets(itemType);
    result.fieldsets = fieldsets.map(
      ({ item_type, ...rest }: Fieldset) => rest,
    );
  }

  results.push(result);
}

function filterFieldDetails(
  fields: Field[],
  detailsToInclude: FieldDetailsOption[],
): Field[] {
  return fields.map((field: Field) => {
    const { validators, appearance, default_value, ...rest } = field;
    const out: Partial<Field> = { ...rest };
    if (detailsToInclude.includes('validators')) out.validators = validators;
    if (detailsToInclude.includes('appearance')) out.appearance = appearance;
    if (detailsToInclude.includes('default_values'))
      out.default_value = default_value;
    return out as Field;
  });
}

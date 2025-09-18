import type { CmaClient } from '@datocms/cli-utils';
import { format as prettier } from 'prettier';
import * as ts from 'typescript';

export interface SchemaTypesGeneratorOptions {
  itemTypesFilter?: string;
  environment?: string;
}

export class SchemaTypesGenerator {
  constructor(private client: CmaClient.Client) {}

  async generateSchemaTypes(
    options: SchemaTypesGeneratorOptions = {},
  ): Promise<string> {
    const { data, included } = await this.client.site.rawFind({
      include: 'item_types,item_types.fields',
    });

    if (!included) {
      throw new Error('This should not happen');
    }

    const locales = data.attributes.locales;
    const allItemTypes = included.filter((item) => item.type === 'item_type');
    const allFields = included.filter((item) => item.type === 'field');

    const { itemTypes, fields } = this.filterItemTypesAndFields(
      allItemTypes,
      allFields,
      options.itemTypesFilter,
    );

    const generatedCode = this.generateTypeDefinitions(
      itemTypes,
      fields,
      locales,
      '@datocms/cma-client',
    );

    return await prettier(generatedCode, {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'all',
    });
  }

  async generateSchemaTypesForMigration(
    options: SchemaTypesGeneratorOptions = {},
  ): Promise<string> {
    const { data, included } = await this.client.site.rawFind({
      include: 'item_types,item_types.fields',
    });

    if (!included) {
      throw new Error('This should not happen');
    }

    const locales = data.attributes.locales;
    const allItemTypes = included.filter((item) => item.type === 'item_type');
    const allFields = included.filter((item) => item.type === 'field');

    const { itemTypes, fields } = this.filterItemTypesAndFields(
      allItemTypes,
      allFields,
      options.itemTypesFilter,
    );

    // Generate only the type definitions without import statement
    const generatedCode = this.generateTypeDefinitionsOnly(
      itemTypes,
      fields,
      locales,
    );

    return await prettier(generatedCode, {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'all',
    });
  }

  private filterItemTypesAndFields(
    allItemTypes: CmaClient.RawApiTypes.ItemType[],
    allFields: CmaClient.RawApiTypes.Field[],
    itemTypesFilter?: string,
  ): {
    itemTypes: CmaClient.RawApiTypes.ItemType[];
    fields: CmaClient.RawApiTypes.Field[];
  } {
    if (!itemTypesFilter) {
      return { itemTypes: allItemTypes, fields: allFields };
    }

    const requestedApiKeys = new Set(
      itemTypesFilter
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    );

    // Create maps for quick lookups
    const itemTypeByApiKey = new Map<string, CmaClient.RawApiTypes.ItemType>();
    const itemTypeById = new Map<string, CmaClient.RawApiTypes.ItemType>();
    const fieldsByItemTypeId = new Map<string, CmaClient.RawApiTypes.Field[]>();

    for (const itemType of allItemTypes) {
      itemTypeByApiKey.set(itemType.attributes.api_key, itemType);
      itemTypeById.set(itemType.id, itemType);
    }

    for (const field of allFields) {
      const itemTypeId = field.relationships.item_type.data.id;
      if (!fieldsByItemTypeId.has(itemTypeId)) {
        fieldsByItemTypeId.set(itemTypeId, []);
      }
      fieldsByItemTypeId.get(itemTypeId)!.push(field);
    }

    // Find all required item types including dependencies
    const requiredItemTypeIds = new Set<string>();

    // Add directly requested item types
    for (const apiKey of requestedApiKeys) {
      const itemType = itemTypeByApiKey.get(apiKey);
      if (itemType) {
        requiredItemTypeIds.add(itemType.id);
      }
    }

    // Track processed item types to avoid infinite recursion
    const processedItemTypeIds = new Set<string>();

    // Recursively find dependencies from block fields
    const findDependencies = (itemTypeId: string) => {
      if (processedItemTypeIds.has(itemTypeId)) {
        return; // Already processed
      }

      processedItemTypeIds.add(itemTypeId);
      requiredItemTypeIds.add(itemTypeId);
      const itemFields = fieldsByItemTypeId.get(itemTypeId) || [];

      for (const field of itemFields) {
        const fieldType = field.attributes.field_type;
        let dependentItemTypeIds: string[] = [];

        if (
          fieldType === 'rich_text' &&
          field.attributes.validators.rich_text_blocks
        ) {
          dependentItemTypeIds =
            field.attributes.validators.rich_text_blocks.item_types;
        } else if (fieldType === 'structured_text') {
          const blockIds =
            field.attributes.validators.structured_text_blocks?.item_types ||
            [];
          const linkIds =
            field.attributes.validators.structured_text_links?.item_types || [];
          dependentItemTypeIds = [...blockIds, ...linkIds];
        } else if (
          fieldType === 'single_block' &&
          field.attributes.validators.single_block_blocks
        ) {
          dependentItemTypeIds =
            field.attributes.validators.single_block_blocks.item_types;
        }

        for (const depId of dependentItemTypeIds) {
          findDependencies(depId);
        }
      }
    };

    // Start dependency resolution from requested item types
    const initialIds = Array.from(requiredItemTypeIds);
    for (const itemTypeId of initialIds) {
      findDependencies(itemTypeId);
    }

    // Filter item types and fields based on required IDs
    const filteredItemTypes = allItemTypes.filter((itemType) =>
      requiredItemTypeIds.has(itemType.id),
    );

    const filteredFields = allFields.filter((field) =>
      requiredItemTypeIds.has(field.relationships.item_type.data.id),
    );

    return { itemTypes: filteredItemTypes, fields: filteredFields };
  }

  private generateTypeDefinitions(
    itemTypes: CmaClient.RawApiTypes.ItemType[],
    fields: CmaClient.RawApiTypes.Field[],
    locales: string[],
    importPath: string,
  ): string {
    const fieldsByItemType = new Map<string, CmaClient.RawApiTypes.Field[]>();
    const itemTypeIdToTypeName = new Map<string, string>();

    for (const itemType of itemTypes) {
      itemTypeIdToTypeName.set(
        itemType.id,
        this.toPascalCase(itemType.attributes.api_key),
      );
    }

    for (const field of fields) {
      const itemTypeId = field.relationships.item_type.data.id;
      if (!fieldsByItemType.has(itemTypeId)) {
        fieldsByItemType.set(itemTypeId, []);
      }
      fieldsByItemType.get(itemTypeId)!.push(field);
    }

    const sourceFile = ts.createSourceFile(
      'schema.ts',
      '',
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS,
    );

    // Creates: import { ItemTypeDefinition } from '@datocms/cma-client';
    const importDeclaration = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier('ItemTypeDefinition'),
          ),
        ]),
      ),
      ts.factory.createStringLiteral(importPath),
    );

    // Create EnvironmentSettings type with locale union
    const localeUnion = ts.factory.createUnionTypeNode(
      locales.map((locale) =>
        ts.factory.createLiteralTypeNode(
          ts.factory.createStringLiteral(locale),
        ),
      ),
    );

    const environmentSettingsType = ts.factory.createTypeAliasDeclaration(
      undefined,
      ts.factory.createIdentifier('EnvironmentSettings'),
      undefined,
      ts.factory.createTypeLiteralNode([
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier('locales'),
          undefined,
          localeUnion,
        ),
      ]),
    );

    const typeDeclarations: ts.TypeAliasDeclaration[] = [
      environmentSettingsType,
    ];

    for (const itemType of itemTypes) {
      const itemTypeFields = fieldsByItemType.get(itemType.id) || [];
      const fieldDefinitions = this.createFieldDefinitions(
        itemTypeFields,
        itemTypeIdToTypeName,
        itemType,
      );

      // Creates: export type Article = ItemTypeDefinition<EnvironmentSettings, "item_type_id", { title: { type: 'string' } }>;
      const typeDeclaration = ts.factory.createTypeAliasDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createIdentifier(
          this.toPascalCase(itemType.attributes.api_key),
        ),
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier('ItemTypeDefinition'),
          [
            ts.factory.createTypeReferenceNode(
              ts.factory.createIdentifier('EnvironmentSettings'),
            ),
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(itemType.id),
            ),
            fieldDefinitions,
          ],
        ),
      );

      typeDeclarations.push(typeDeclaration);
    }

    const statements = [importDeclaration, ...typeDeclarations];

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });

    return printer.printList(
      ts.ListFormat.MultiLine,
      ts.factory.createNodeArray(statements),
      sourceFile,
    );
  }

  private generateTypeDefinitionsOnly(
    itemTypes: CmaClient.RawApiTypes.ItemType[],
    fields: CmaClient.RawApiTypes.Field[],
    locales: string[],
  ): string {
    const fieldsByItemType = new Map<string, CmaClient.RawApiTypes.Field[]>();
    const itemTypeIdToTypeName = new Map<string, string>();

    for (const itemType of itemTypes) {
      itemTypeIdToTypeName.set(
        itemType.id,
        this.toPascalCase(itemType.attributes.api_key),
      );
    }

    for (const field of fields) {
      const itemTypeId = field.relationships.item_type.data.id;
      if (!fieldsByItemType.has(itemTypeId)) {
        fieldsByItemType.set(itemTypeId, []);
      }
      fieldsByItemType.get(itemTypeId)!.push(field);
    }

    const sourceFile = ts.createSourceFile(
      'schema.ts',
      '',
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS,
    );

    // Create EnvironmentSettings type with locale union
    const localeUnion = ts.factory.createUnionTypeNode(
      locales.map((locale) =>
        ts.factory.createLiteralTypeNode(
          ts.factory.createStringLiteral(locale),
        ),
      ),
    );

    const environmentSettingsType = ts.factory.createTypeAliasDeclaration(
      undefined,
      ts.factory.createIdentifier('EnvironmentSettings'),
      undefined,
      ts.factory.createTypeLiteralNode([
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier('locales'),
          undefined,
          localeUnion,
        ),
      ]),
    );

    const typeDeclarations: ts.TypeAliasDeclaration[] = [
      environmentSettingsType,
    ];

    for (const itemType of itemTypes) {
      const itemTypeFields = fieldsByItemType.get(itemType.id) || [];
      const fieldDefinitions = this.createFieldDefinitions(
        itemTypeFields,
        itemTypeIdToTypeName,
        itemType,
      );

      // Creates: export type Article = ItemTypeDefinition<EnvironmentSettings, "item_type_id", { title: { type: 'string' } }>;
      const typeDeclaration = ts.factory.createTypeAliasDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createIdentifier(
          this.toPascalCase(itemType.attributes.api_key),
        ),
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier('ItemTypeDefinition'),
          [
            ts.factory.createTypeReferenceNode(
              ts.factory.createIdentifier('EnvironmentSettings'),
            ),
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(itemType.id),
            ),
            fieldDefinitions,
          ],
        ),
      );

      typeDeclarations.push(typeDeclaration);
    }

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });

    return printer.printList(
      ts.ListFormat.MultiLine,
      ts.factory.createNodeArray(typeDeclarations),
      sourceFile,
    );
  }

  private createFieldDefinitions(
    fields: CmaClient.RawApiTypes.Field[],
    itemTypeIdToTypeName: Map<string, string>,
    itemType: CmaClient.RawApiTypes.ItemType,
  ): ts.TypeLiteralNode {
    const properties: ts.PropertySignature[] = [];

    for (const field of fields) {
      const fieldType = this.mapFieldType(field, itemTypeIdToTypeName);
      // Creates: title: { type: 'string' };
      const property = ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(field.attributes.api_key),
        undefined,
        fieldType,
      );
      properties.push(property);
    }

    // Add virtual fields for sortable and tree models
    if (itemType.attributes.sortable || itemType.attributes.tree) {
      properties.push(this.createVirtualFieldProperty('position', 'integer'));
    }

    if (itemType.attributes.tree) {
      properties.push(this.createVirtualFieldProperty('parent_id', 'string'));
    }

    // Creates: { title: { type: 'string' }; content: { type: 'rich_text' } }
    return ts.factory.createTypeLiteralNode(properties);
  }

  private mapFieldType(
    field: CmaClient.RawApiTypes.Field,
    itemTypeIdToTypeName: Map<string, string>,
  ): ts.TypeNode {
    let baseType: ts.TypeNode;

    switch (field.attributes.field_type) {
      case 'rich_text':
        // Creates: { type: 'rich_text'; blocks: ImageBlock | VideoBlock }
        baseType = ts.factory.createTypeLiteralNode([
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier('type'),
            undefined,
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral('rich_text'),
            ),
          ),
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier('blocks'),
            undefined,
            this.createBlocksUnion(
              field.attributes.validators.rich_text_blocks.item_types,
              itemTypeIdToTypeName,
            ),
          ),
        ]);
        break;

      case 'structured_text': {
        // Creates: { type: 'structured_text'; blocks: ImageBlock | VideoBlock; inline_blocks: LinkBlock }
        const properties = [
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier('type'),
            undefined,
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral('structured_text'),
            ),
          ),
        ];

        // Only add blocks property if there are configured block types
        if (
          field.attributes.validators.structured_text_blocks.item_types.length >
          0
        ) {
          properties.push(
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier('blocks'),
              undefined,
              this.createBlocksUnion(
                field.attributes.validators.structured_text_blocks.item_types,
                itemTypeIdToTypeName,
              ),
            ),
          );
        }

        // Only add inline_blocks property if there are configured inline block types
        if (
          field.attributes.validators.structured_text_links.item_types.length >
          0
        ) {
          properties.push(
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier('inline_blocks'),
              undefined,
              this.createBlocksUnion(
                field.attributes.validators.structured_text_links.item_types,
                itemTypeIdToTypeName,
              ),
            ),
          );
        }

        baseType = ts.factory.createTypeLiteralNode(properties);
        break;
      }

      case 'single_block':
        // Creates: { type: 'single_block'; blocks: ImageBlock | VideoBlock }
        baseType = ts.factory.createTypeLiteralNode([
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier('type'),
            undefined,
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral('single_block'),
            ),
          ),
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier('blocks'),
            undefined,
            this.createBlocksUnion(
              field.attributes.validators.single_block_blocks.item_types,
              itemTypeIdToTypeName,
            ),
          ),
        ]);
        break;

      default:
        // Creates: { type: 'string' } or { type: 'text' } etc.
        baseType = ts.factory.createTypeLiteralNode([
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier('type'),
            undefined,
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(field.attributes.field_type),
            ),
          ),
        ]);
    }

    if (field.attributes.localized) {
      const properties = Array.from(
        (baseType as ts.TypeLiteralNode).members,
      ) as ts.PropertySignature[];

      // Creates: localized: true
      properties.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier('localized'),
          undefined,
          ts.factory.createLiteralTypeNode(ts.factory.createTrue()),
        ),
      );

      return ts.factory.createTypeLiteralNode(properties);
    }

    return baseType;
  }

  private createBlocksUnion(
    itemTypeIds: string[],
    itemTypeIdToTypeName: Map<string, string>,
  ): ts.TypeNode {
    if (itemTypeIds.length === 0) {
      // Creates: never
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
    }

    const validTypeNames = itemTypeIds
      .map((id) => itemTypeIdToTypeName.get(id))
      .filter(Boolean) as string[];

    if (validTypeNames.length === 0) {
      // Creates: never
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
    }

    if (validTypeNames.length === 1) {
      // Creates: ImageBlock
      return ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier(validTypeNames[0]),
      );
    }

    // Creates: ImageBlock | VideoBlock | TextBlock
    return ts.factory.createUnionTypeNode(
      validTypeNames.map((typeName) =>
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier(typeName),
        ),
      ),
    );
  }

  private createVirtualFieldProperty(
    fieldName: string,
    fieldType: string,
  ): ts.PropertySignature {
    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(fieldName),
      undefined,
      ts.factory.createTypeLiteralNode([
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier('type'),
          undefined,
          ts.factory.createLiteralTypeNode(
            ts.factory.createStringLiteral(fieldType),
          ),
        ),
      ]),
    );
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
}

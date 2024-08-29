import type { CmaClient } from '@datocms/cli-utils';
import * as ts from 'typescript';

export function buildFieldsetTitle(fieldset: CmaClient.SchemaTypes.Fieldset) {
  return `fieldset "${fieldset.attributes.title}"`;
}

const fieldTypeName: Record<string, string> = {
  boolean: 'Boolean',
  color: 'Color',
  date: 'Date',
  date_time: 'DateTime',
  file: 'Single asset',
  float: 'Floating-point number',
  gallery: 'Asset gallery',
  image: 'Image',
  integer: 'Integer number',
  json: 'JSON',
  lat_lon: 'Geolocation',
  link: 'Single link',
  links: 'Multiple links',
  rich_text: 'Modular Content (Multiple blocks)',
  single_block: 'Modular Content (Single block)',
  seo: 'SEO meta tags',
  slug: 'Slug',
  string: 'Single-line string',
  structured_text: 'Structured text',
  text: 'Multiple-paragraph text',
  video: 'External video',
};

export function buildMenuItemTitle(menuItem: CmaClient.SchemaTypes.MenuItem) {
  return `menu item "${menuItem.attributes.label}"`;
}

export function buildUploadCollectionTitle(
  menuItem: CmaClient.SchemaTypes.UploadCollection,
) {
  return `upload collection "${menuItem.attributes.label}"`;
}

export function buildSchemaMenuItemTitle(
  schemaMenuItem: CmaClient.SchemaTypes.SchemaMenuItem,
  itemType: CmaClient.SchemaTypes.ItemType | undefined,
) {
  const context =
    schemaMenuItem.attributes.kind === 'item_type' ? 'model' : 'block';

  const name = itemType
    ? `for ${buildItemTypeTitle(itemType)}`
    : `"${schemaMenuItem.attributes.label}"`;

  return `${context} schema menu item ${name}`;
}

export function buildWorkflowTitle(workflow: CmaClient.SchemaTypes.Workflow) {
  return `workflow "${workflow.attributes.name}"`;
}

export function buildPluginTitle(plugin: CmaClient.SchemaTypes.Plugin) {
  return `plugin "${plugin.attributes.name}"`;
}

export function buildUploadFilterTitle(
  uploadFilter: CmaClient.SchemaTypes.UploadFilter,
) {
  return `Media Area filter "${uploadFilter.attributes.name}"`;
}

export function buildItemTypeFilterTitle(
  itemTypeFilter: CmaClient.SchemaTypes.ItemTypeFilter,
) {
  return `filter "${itemTypeFilter.attributes.name}"`;
}

export function buildFieldTitle(field: CmaClient.SchemaTypes.Field) {
  return `${fieldTypeName[field.attributes.field_type]} field "${
    field.attributes.label
  }" (\`${field.attributes.api_key}\`)`;
}

export function buildItemTypeTitle(itemType: CmaClient.SchemaTypes.ItemType) {
  const itemTypeApiKey = itemType.attributes.api_key;
  const itemTypeName = itemType.attributes.name;
  return `${
    itemType.attributes.modular_block ? 'block model' : 'model'
  } "${itemTypeName}" (\`${itemTypeApiKey}\`)`;
}

export function debugNode(node: ts.Node, indentation = 0) {
  console.log(' '.repeat(indentation) + ts.SyntaxKind[node.kind]);
  node.forEachChild((child) => {
    debugNode(child, indentation + 1);
  });
}

export function debugCodeAst(code: string) {
  const sourceFile = ts.createSourceFile(
    'someFileName.ts',
    code,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS,
  );

  debugNode(sourceFile);
}

export function parseAstFromCode(code: string) {
  const sourceFile = ts.createSourceFile(
    'someFileName.ts',
    code,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS,
  );

  return sourceFile;
}

export function writeCodeFromAst(nodes: ts.NodeArray<ts.Node>) {
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
    omitTrailingSemicolon: false,
  });

  const sourceFile = ts.createSourceFile(
    'someFileName.ts',
    '',
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS,
  );

  return printer.printList(
    ts.ListFormat.MultiLineBlockStatements,
    nodes,
    sourceFile,
  );
}

type ReplaceFn = (
  path: Array<string | number>,
  original: unknown,
) => ts.Expression | undefined;

type Options = {
  parentPath?: Array<string | number>;
  replace?: ReplaceFn;
};

export function createJsonLiteral(
  element: unknown,
  options?: Options,
): ts.Expression {
  const parentPath = options?.parentPath || [];
  const replace: ReplaceFn = options?.replace || (() => undefined);

  const replacement = replace(parentPath, element);

  if (replacement !== undefined) {
    return replacement;
  }

  if (Array.isArray(element)) {
    return ts.factory.createArrayLiteralExpression(
      element.map((child, i) =>
        createJsonLiteral(child, { parentPath: [...parentPath, i], replace }),
      ),
    );
  }

  if (element === null || element === undefined) {
    return ts.factory.createNull();
  }

  if (typeof element === 'object') {
    return ts.factory.createObjectLiteralExpression(
      Object.entries(element).map(([property, child]) =>
        ts.factory.createPropertyAssignment(
          ts.factory.createStringLiteral(property),
          createJsonLiteral(child, {
            parentPath: [...parentPath, property],
            replace,
          }),
        ),
      ),
    );
  }

  if (typeof element === 'string') {
    return ts.factory.createStringLiteral(element);
  }

  if (typeof element === 'boolean') {
    return element ? ts.factory.createTrue() : ts.factory.createFalse();
  }

  if (typeof element === 'number') {
    return ts.factory.createNumericLiteral(element);
  }

  throw new Error(`Don't know how to handle ${element}`);
}

function isPositiveInteger(id: string) {
  const n = Math.floor(Number(id));
  return n !== Number.POSITIVE_INFINITY && String(n) === id && n >= 0;
}

export function isBase64Id(id: string) {
  return id.length === 22 && !isPositiveInteger(id);
}

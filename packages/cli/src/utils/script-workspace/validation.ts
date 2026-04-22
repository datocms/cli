import ts from 'typescript';

export type ScriptFormat = 'default-export' | 'top-level';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  format: ScriptFormat;
}

export interface ValidationOptions {
  /**
   * Patterns of allowed import specifiers. If `null` or omitted, the import
   * allowlist check is disabled entirely (any import passes).
   */
  allowedPackages?: string[] | null;
  /**
   * If set, the script must match this format and anything else is rejected:
   * - `'default-export'`: script must export a default async function.
   *   Top-level scripts without a default export are rejected.
   * - `'top-level'`: script must be plain top-level code. Any default export
   *   is rejected.
   */
  requiredFormat?: ScriptFormat;
}

export const DEFAULT_ALLOWED_PACKAGES = [
  '@datocms/*',
  'datocms-*',
  'parse5',
  'parse5/*',
  './schema',
];

function isImportAllowed(
  importPath: string,
  allowedPatterns: string[],
): boolean {
  return allowedPatterns.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return importPath === prefix || importPath.startsWith(`${prefix}/`);
    }
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return importPath.startsWith(prefix);
    }
    return importPath === pattern;
  });
}

/**
 * Validates that a script follows one of two supported formats:
 *
 * - **default-export** (Format A): exports a default async function with
 *   signature `(client: Client) => Promise<void>`. Portable, compatible with
 *   `migrations:run`.
 * - **top-level** (Format B): no default export. The script runs as a plain
 *   ESM module; `client` and `Schema` are available as ambient globals.
 *
 * In both formats we reject explicit `any`/`unknown` and imports outside the
 * allowed package list.
 */
export function validateScriptStructure(
  content: string,
  options: ValidationOptions = {},
): ValidationResult {
  const allowedPackages =
    options.allowedPackages === undefined
      ? DEFAULT_ALLOWED_PACKAGES
      : options.allowedPackages;
  const errors: string[] = [];

  const sourceFile = ts.createSourceFile(
    'script.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  let hasDefaultExport = false;
  let defaultExportIsValidFunction = false;

  function visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(),
      );
      errors.push(
        `Explicit 'any' type at line ${line + 1}, column ${
          character + 1
        }. Use a specific type instead.`,
      );
    }

    if (node.kind === ts.SyntaxKind.UnknownKeyword) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(),
      );
      errors.push(
        `Explicit 'unknown' type at line ${line + 1}, column ${
          character + 1
        }. Use a specific type instead.`,
      );
    }

    if (ts.isImportDeclaration(node) && allowedPackages) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        if (!isImportAllowed(importPath, allowedPackages)) {
          const allowedPatternsStr = allowedPackages.join(', ');
          errors.push(
            `Invalid import: "${importPath}". Only imports from these packages are allowed: ${allowedPatternsStr}`,
          );
        }
      }
    }

    if (ts.isExportAssignment(node)) {
      hasDefaultExport = true;
      const expression = node.expression;

      if (
        ts.isFunctionExpression(expression) ||
        ts.isArrowFunction(expression)
      ) {
        defaultExportIsValidFunction = validateFunctionSignature(
          expression,
          errors,
        );
      } else if (ts.isIdentifier(expression)) {
        const functionDecl = findFunctionDeclaration(
          sourceFile,
          expression.text,
        );
        if (functionDecl) {
          if (ts.isFunctionDeclaration(functionDecl)) {
            defaultExportIsValidFunction = validateFunctionSignature(
              functionDecl,
              errors,
            );
          } else if (ts.isVariableDeclaration(functionDecl)) {
            const init = functionDecl.initializer;
            if (
              init &&
              (ts.isFunctionExpression(init) || ts.isArrowFunction(init))
            ) {
              defaultExportIsValidFunction = validateFunctionSignature(
                init,
                errors,
              );
            } else {
              errors.push(
                'Default export must reference a function with signature: async (client: Client) => Promise<void>',
              );
            }
          }
        } else {
          errors.push(
            'Default export must reference a function with signature: async (client: Client) => Promise<void>',
          );
        }
      } else {
        errors.push(
          'Default export must be a function with signature: async (client: Client) => Promise<void>',
        );
      }
    }

    if (
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some(
        (m) =>
          m.kind === ts.SyntaxKind.ExportKeyword ||
          m.kind === ts.SyntaxKind.DefaultKeyword,
      )
    ) {
      const hasExport = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
      const hasDefault = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
      );

      if (hasExport && hasDefault) {
        hasDefaultExport = true;
        defaultExportIsValidFunction = validateFunctionSignature(node, errors);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const format: ScriptFormat = hasDefaultExport
    ? 'default-export'
    : 'top-level';

  // If a default export is present, its signature must be valid.
  // If no default export, we fall back to top-level — no signature check
  // needed; validateFunctionSignature already added any errors.
  if (hasDefaultExport && !defaultExportIsValidFunction) {
    // Errors already pushed by validateFunctionSignature.
  }

  if (options.requiredFormat && options.requiredFormat !== format) {
    // Format mismatch makes any other structural error noise — the script is
    // in the wrong place entirely. Replace the error list with just the
    // mismatch message so the user sees the real issue.
    const mismatchMessage =
      options.requiredFormat === 'default-export'
        ? 'File-mode scripts must export a default async function with signature `(client: Client) => Promise<void>`. For top-level scripts, pipe the source via stdin instead.'
        : 'Stdin scripts must use top-level code only; `export default` is not supported here. Move the script into a file and run `datocms cma:script <file>` to use a default-export function.';

    return {
      valid: false,
      errors: [mismatchMessage],
      format,
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    format,
  };
}

function isValidParameterType(typeNode: ts.TypeNode): boolean {
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;

    if (ts.isIdentifier(typeName) && typeName.text === 'Client') {
      return true;
    }

    if (ts.isIdentifier(typeName) && typeName.text === 'ReturnType') {
      const typeArgs = typeNode.typeArguments;
      if (typeArgs && typeArgs.length === 1) {
        const typeArg = typeArgs[0];
        if (typeArg && ts.isTypeQueryNode(typeArg)) {
          const exprName = typeArg.exprName;
          if (ts.isIdentifier(exprName) && exprName.text === 'buildClient') {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function validateFunctionSignature(
  func:
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.MethodDeclaration,
  errors: string[],
): boolean {
  const hasAsyncModifier = func.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
  );

  const returnType = func.type;
  let returnsPromise = false;

  if (returnType && ts.isTypeReferenceNode(returnType)) {
    const typeName = returnType.typeName;
    if (ts.isIdentifier(typeName) && typeName.text === 'Promise') {
      returnsPromise = true;
    }
  }

  if (!hasAsyncModifier && !returnsPromise) {
    errors.push(
      'Default export function must be async or return a Promise<void>',
    );
    return false;
  }

  if (!func.parameters || func.parameters.length !== 1) {
    errors.push(
      'Default export function must have exactly one parameter of type Client or ReturnType<typeof buildClient>',
    );
    return false;
  }

  const param = func.parameters[0];
  if (!param) {
    errors.push(
      'Default export function must have exactly one parameter of type Client or ReturnType<typeof buildClient>',
    );
    return false;
  }

  if (param.type) {
    if (!isValidParameterType(param.type)) {
      errors.push(
        'Default export function parameter must be of type "Client" or "ReturnType<typeof buildClient>"',
      );
      return false;
    }
  } else {
    errors.push(
      'Default export function parameter must have type annotation: Client or ReturnType<typeof buildClient>',
    );
    return false;
  }

  return true;
}

function findFunctionDeclaration(
  sourceFile: ts.SourceFile,
  name: string,
): ts.FunctionDeclaration | ts.VariableDeclaration | undefined {
  let result: ts.FunctionDeclaration | ts.VariableDeclaration | undefined;

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      result = node;
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name) {
          result = decl;
        }
      }
    }
    if (!result) {
      ts.forEachChild(node, visit);
    }
  }

  visit(sourceFile);
  return result;
}

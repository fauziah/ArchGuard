/**
 * TypeScript AST parser utilities
 * Provides functions to parse TypeScript source code
 */

import * as ts from "typescript";
import { ImportInfo } from "./index";

export function parseTypeScript(sourceCode: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

export function extractImports(sourceFile: ts.SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const from = moduleSpecifier.text;
        const specifiers: string[] = [];
        let isTypeOnly = false;

        if (node.importClause) {
          isTypeOnly = node.importClause.isTypeOnly || false;

          if (node.importClause.namedBindings) {
            if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              specifiers.push(node.importClause.namedBindings.name.text);
            } else if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (const element of node.importClause.namedBindings.elements) {
                specifiers.push(element.name.text);
              }
            }
          }

          if (node.importClause.name) {
            specifiers.push(node.importClause.name.text);
          }
        }

        imports.push({
          from,
          specifiers,
          isTypeOnly,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return imports;
}

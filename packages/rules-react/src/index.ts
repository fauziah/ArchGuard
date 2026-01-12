/**
 * React-specific rules for archguard
 * Implements rules to enforce React architecture constraints
 */

import * as ts from "typescript";
import * as path from "path";
import {
  Rule,
  RuleContext,
  RuleResult,
  Violation,
  parseTypeScript,
  extractImports,
} from "@archguard/core";

export function createLayerImportBoundaryRule(): Rule {
  return {
    name: "layer-import-boundary",
    description: "Enforces layer import boundaries",
    execute(context: RuleContext): RuleResult {
      const violations: Violation[] = [];

      if (!context.architecture.rules.enforceFeatureBoundaries) {
        return { violations: [], passed: true };
      }

      const filePath = context.filePath;
      const layerName = detectLayerFromPath(filePath, context.architecture.layers);

      if (!layerName) {
        return { violations: [], passed: true };
      }

      const layerConfig = context.architecture.layers[layerName];
      if (!layerConfig) {
        return { violations: [], passed: true };
      }

      const allowedLayers = new Set(layerConfig.allowedImports);

      for (const imp of context.imports) {
        if (isRelativeImport(imp.from)) {
          const importedLayer = detectLayerFromImportPath(
            imp.from,
            filePath,
            context.architecture.layers
          );

          if (importedLayer && importedLayer !== layerName) {
            if (!allowedLayers.has(importedLayer)) {
              const sourceFile = parseTypeScript(context.sourceCode, context.filePath);
              const importNode = findImportNode(sourceFile, imp.from);

              if (importNode) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(
                  importNode.getStart()
                );

                const allowedList = layerConfig.allowedImports.length > 0 
                  ? layerConfig.allowedImports.join(", ") 
                  : "none";
                violations.push({
                  file: filePath,
                  line: line + 1,
                  column: character + 1,
                  message: `Layer '${layerName}' cannot import from '${importedLayer}'. Import from allowed layers only: ${allowedList}. Move the imported code to an allowed layer or restructure dependencies.`,
                  rule: "layer-import-boundary",
                });
              }
            }
          }
        }
      }

      return {
        violations,
        passed: violations.length === 0,
      };
    },
  };
}

export function createBusinessLogicInComponentsRule(): Rule {
  return {
    name: "no-business-logic-in-components",
    description: "Detects business logic inside React components",
    execute(context: RuleContext): RuleResult {
      const violations: Violation[] = [];

      if (!context.architecture.rules.noBusinessLogicInComponents) {
        return { violations: [], passed: true };
      }

      const sourceFile = parseTypeScript(context.sourceCode, context.filePath);
      const isComponentFile = isReactComponentFile(sourceFile);

      if (!isComponentFile) {
        return { violations: [], passed: true };
      }

      function visit(node: ts.Node): void {
        if (isComponentFunction(node)) {
          checkForBusinessLogic(node, sourceFile, violations, context.filePath);
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      return {
        violations,
        passed: violations.length === 0,
      };
    },
  };
}

export function createDataFetchingInUIRule(): Rule {
  return {
    name: "no-data-fetching-in-ui",
    description: "Prevents data fetching inside UI components",
    execute(context: RuleContext): RuleResult {
      const violations: Violation[] = [];

      if (!context.architecture.rules.noDataFetchingInUI) {
        return { violations: [], passed: true };
      }

      const sourceFile = parseTypeScript(context.sourceCode, context.filePath);
      const isComponentFile = isReactComponentFile(sourceFile);

      if (!isComponentFile) {
        return { violations: [], passed: true };
      }

      const forbiddenPatterns = [
        /fetch\s*\(/,
        /axios\./,
        /\.get\s*\(/,
        /\.post\s*\(/,
        /\.put\s*\(/,
        /\.delete\s*\(/,
        /useEffect\s*\([^)]*=>\s*\{[^}]*fetch/,
        /useEffect\s*\([^)]*=>\s*\{[^}]*axios/,
      ];

      const sourceText = context.sourceCode;

      for (const pattern of forbiddenPatterns) {
        const matches = sourceText.matchAll(new RegExp(pattern.source, "g"));
        for (const match of matches) {
          if (match.index !== undefined) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(match.index);

            violations.push({
              file: context.filePath,
              line: line + 1,
              column: character + 1,
              message: "Data fetching in UI component violates architecture. Create a custom hook in the features layer (e.g. useUserData) and call it from the component.",
              rule: "no-data-fetching-in-ui",
            });
          }
        }
      }

      return {
        violations,
        passed: violations.length === 0,
      };
    },
  };
}

export function createCircularDependencyRule(): Rule {
  return {
    name: "no-circular-layer-deps",
    description: "Detects circular dependencies across layers",
    execute(context: RuleContext): RuleResult {
      const violations: Violation[] = [];

      if (!context.architecture.rules.noCircularLayerDeps) {
        return { violations: [], passed: true };
      }

      if (!context.importGraph) {
        return { violations: [], passed: true };
      }

      const cycles = detectCycles(context.importGraph);
      
      for (const cycle of cycles) {
        const sortedCycle = [...cycle].sort();
        const firstFileInCycle = sortedCycle[0];
        
        if (context.filePath === firstFileInCycle) {
          const cyclePath = cycle.join(" → ");
          
          violations.push({
            file: context.filePath,
            line: 1,
            column: 1,
            message: `Circular dependency detected: ${cyclePath}. Break the cycle by extracting shared code to a common layer or using dependency inversion.`,
            rule: "no-circular-layer-deps",
          });
        }
      }

      return {
        violations,
        passed: violations.length === 0,
      };
    },
  };
}

function detectCycles(graph: { [filePath: string]: string[] }): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart).concat([neighbor]);
          cycles.push(cycle);
        }
      }
    }

    recStack.delete(node);
    path.pop();
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

function detectLayerFromPath(filePath: string, layers: Record<string, any>): string | null {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const layerNames = Object.keys(layers);

  for (const layerName of layerNames) {
    if (normalizedPath.includes(`/${layerName}/`) || normalizedPath.includes(`\\${layerName}\\`)) {
      return layerName;
    }
  }

  return null;
}

function detectLayerFromImportPath(
  importPath: string,
  fromFile: string,
  layers: Record<string, any>
): string | null {
  const resolvedPath = path.resolve(path.dirname(fromFile), importPath);
  return detectLayerFromPath(resolvedPath, layers);
}

function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith(".") || importPath.startsWith("/");
}

function findImportNode(sourceFile: ts.SourceFile, importPath: string): ts.Node | null {
  let found: ts.Node | null = null;

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === importPath) {
        found = node;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function isReactComponentFile(sourceFile: ts.SourceFile): boolean {
  let hasReactImport = false;
  let hasComponent = false;

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === "react") {
        hasReactImport = true;
      }
    }

    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      if (isComponentFunction(node)) {
        hasComponent = true;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return hasReactImport && hasComponent;
}

function isComponentFunction(node: ts.Node): boolean {
  if (!ts.isFunctionDeclaration(node) && !ts.isFunctionExpression(node) && !ts.isArrowFunction(node)) {
    return false;
  }

  const name = ts.isFunctionDeclaration(node) && node.name ? node.name.text : null;
  if (name && (name[0] === name[0].toUpperCase() || name.startsWith("use"))) {
    return true;
  }

  return false;
}

function checkForBusinessLogic(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  violations: Violation[],
  filePath: string
): void {
  function visit(n: ts.Node): void {
    if (ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(n.getStart());
      violations.push({
        file: filePath,
        line: line + 1,
        column: character + 1,
        message: "Loop detected in UI component. Extract loop logic to a utility function in features/domain layer and pass processed data as props.",
        rule: "no-business-logic-in-components",
      });
    }

    if (ts.isIfStatement(n) && !isSimpleConditional(n)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(n.getStart());
      violations.push({
        file: filePath,
        line: line + 1,
        column: character + 1,
        message: "Complex conditional in UI component. Extract to a custom hook (e.g. useConditionalLogic) in features layer or move to domain utilities.",
        rule: "no-business-logic-in-components",
      });
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
}

function isSimpleConditional(node: ts.IfStatement): boolean {
  const expression = node.expression;
  return (
    ts.isIdentifier(expression) ||
    ts.isPropertyAccessExpression(expression) ||
    ts.isBinaryExpression(expression)
  );
}

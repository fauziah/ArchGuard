/**
 * Core rule engine for archguard
 * 
 * This package provides the foundational types and interfaces
 * for rule execution. It does NOT know about React or Cursor.
 */

export interface Violation {
  file: string;
  line: number;
  column: number;
  message: string;
  rule: string;
}

export interface ImportGraph {
  [filePath: string]: string[]; // filePath -> array of imported file paths
}

export interface RuleContext {
  filePath: string;
  sourceCode: string;
  ast: any; // TypeScript AST node
  imports: ImportInfo[];
  architecture: ArchitectureConfig;
  importGraph?: ImportGraph; // Optional: full import graph for circular dependency detection
}

export interface ImportInfo {
  from: string;
  specifiers: string[];
  isTypeOnly: boolean;
}

export interface RuleResult {
  violations: Violation[];
  passed: boolean;
}

export interface Rule {
  name: string;
  description: string;
  execute(context: RuleContext): RuleResult;
}

export interface ArchitectureConfig {
  layers: Record<string, LayerConfig>;
  rules: {
    noBusinessLogicInComponents?: boolean;
    noDataFetchingInUI?: boolean;
    enforceFeatureBoundaries?: boolean;
    noCircularLayerDeps?: boolean;
  };
}

export interface LayerConfig {
  allowedImports: string[];
}

export class RuleEngine {
  private rules: Rule[] = [];

  registerRule(rule: Rule): void {
    this.rules.push(rule);
  }

  executeRules(context: RuleContext): RuleResult {
    const allViolations: Violation[] = [];

    for (const rule of this.rules) {
      const result = rule.execute(context);
      allViolations.push(...result.violations);
    }

    return {
      violations: allViolations,
      passed: allViolations.length === 0,
    };
  }

  getRegisteredRules(): Rule[] {
    return [...this.rules];
  }
}

export { parseTypeScript, extractImports } from "./parser";
export { loadArchitectureConfig, validateArchitectureConfig, findArchitectureConfig } from "./config";

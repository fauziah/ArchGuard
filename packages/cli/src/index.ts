#!/usr/bin/env node

/**
 * CLI for archguard
 * Provides init and check commands
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  RuleEngine,
  RuleContext,
  ImportGraph,
  findArchitectureConfig,
  loadArchitectureConfig,
  parseTypeScript,
  extractImports,
} from "@archguard/core";
import {
  createLayerImportBoundaryRule,
  createBusinessLogicInComponentsRule,
  createDataFetchingInUIRule,
  createCircularDependencyRule,
} from "@archguard/rules-react";
import { generateCursorRules } from "@archguard/cursor";

const program = new Command();

program.name("archguard").description("Architecture guard for React + TypeScript projects").version("1.0.0");

program
  .command("init")
  .description("Initialize archguard in the current project")
  .option("--preset <preset>", "Architecture preset (feature-sliced-react)")
  .action((options) => {
    try {
      initializeArchguard(options.preset);
      console.log(chalk.green("✓ archguard initialized successfully"));
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command("check")
  .description("Check project against architecture rules")
  .action(() => {
    try {
      const result = runChecks();
      if (!result.passed) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program.parse();

function initializeArchguard(preset?: string): void {
  const cwd = process.cwd();

  if (!detectReactTypeScript(cwd)) {
    throw new Error("React + TypeScript project not detected");
  }

  const architectureYamlPath = path.join(cwd, "architecture.yaml");
  if (fs.existsSync(architectureYamlPath)) {
    throw new Error("architecture.yaml already exists");
  }

  let config: string;
  if (preset === "feature-sliced-react") {
    config = getFeatureSlicedReactConfig();
  } else if (preset) {
    throw new Error(`Unknown preset: ${preset}. Available: feature-sliced-react`);
  } else {
    config = getDefaultConfig();
  }

  fs.writeFileSync(architectureYamlPath, config);

  const cursorDir = path.join(cwd, ".cursor");
  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true });
  }

  const cursorRulesPath = path.join(cursorDir, "AI_RULES.md");
  const cursorRules = generateCursorRules(loadArchitectureConfig(architectureYamlPath));
  fs.writeFileSync(cursorRulesPath, cursorRules);

  const gitHooksDir = path.join(cwd, ".git", "hooks");
  if (fs.existsSync(gitHooksDir)) {
    const preCommitPath = path.join(gitHooksDir, "pre-commit");
    const preCommitHook = `#!/bin/sh
# archguard pre-commit hook
npx archguard check || exit 1
`;
    fs.writeFileSync(preCommitPath, preCommitHook);
    fs.chmodSync(preCommitPath, "755");
  }
}

function getDefaultConfig(): string {
  return `layers:
  domain:
    allowedImports: []
  features:
    allowedImports: [domain, shared]
  ui:
    allowedImports: [features, shared]

rules:
  noBusinessLogicInComponents: true
  noDataFetchingInUI: true
  enforceFeatureBoundaries: true
  noCircularLayerDeps: true
`;
}

function getFeatureSlicedReactConfig(): string {
  return `layers:
  app:
    allowedImports: [pages, features, entities, shared]
  pages:
    allowedImports: [features, entities, shared]
  features:
    allowedImports: [entities, shared]
  entities:
    allowedImports: [shared]
  shared:
    allowedImports: []

rules:
  noBusinessLogicInComponents: true
  noDataFetchingInUI: true
  enforceFeatureBoundaries: true
  noCircularLayerDeps: true
`;
}

function detectReactTypeScript(cwd: string): boolean {
  const packageJsonPath = path.join(cwd, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  const hasReact = deps.react || deps["react-dom"];
  const hasTypeScript = deps.typescript || fs.existsSync(path.join(cwd, "tsconfig.json"));

  return !!(hasReact && hasTypeScript);
}

function runChecks(): { passed: boolean; violationCount: number } {
  const cwd = process.cwd();
  const configPath = findArchitectureConfig(cwd);

  if (!configPath) {
    throw new Error("architecture.yaml not found. Run 'archguard init' first.");
  }

  const architecture = loadArchitectureConfig(configPath);
  const engine = new RuleEngine();

  engine.registerRule(createLayerImportBoundaryRule());
  engine.registerRule(createBusinessLogicInComponentsRule());
  engine.registerRule(createDataFetchingInUIRule());
  engine.registerRule(createCircularDependencyRule());

  const sourceFiles = findTypeScriptFiles(cwd);
  const importGraph = buildImportGraph(sourceFiles, cwd);
  const allViolations: any[] = [];

  for (const filePath of sourceFiles) {
    const sourceCode = fs.readFileSync(filePath, "utf-8");
    const ast = parseTypeScript(sourceCode, filePath);
    const imports = extractImports(ast);

    const context: RuleContext = {
      filePath,
      sourceCode,
      ast,
      imports,
      architecture,
      importGraph,
    };

    const result = engine.executeRules(context);
    allViolations.push(...result.violations);
  }

  if (allViolations.length > 0) {
    console.log(chalk.red(`\n✗ Found ${allViolations.length} violation(s):\n`));

    for (const violation of allViolations) {
      console.log(
        chalk.yellow(`${violation.file}:${violation.line}:${violation.column}`) +
          ` - ${violation.message} (${violation.rule})`
      );
    }

    return { passed: false, violationCount: allViolations.length };
  }

  console.log(chalk.green("✓ All checks passed"));
  return { passed: true, violationCount: 0 };
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  const ignoreDirs = ["node_modules", "dist", "build", ".git", ".cursor"];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function buildImportGraph(sourceFiles: string[], cwd: string): ImportGraph {
  const graph: ImportGraph = {};
  const fileSet = new Set(sourceFiles);

  for (const filePath of sourceFiles) {
    const sourceCode = fs.readFileSync(filePath, "utf-8");
    const ast = parseTypeScript(sourceCode, filePath);
    const imports = extractImports(ast);
    const relativeImports: string[] = [];

    for (const imp of imports) {
      if (imp.from.startsWith(".") || imp.from.startsWith("/")) {
        const resolvedPath = resolveImportPath(imp.from, filePath);
        if (resolvedPath && fileSet.has(resolvedPath)) {
          relativeImports.push(resolvedPath);
        }
      }
    }

    graph[filePath] = relativeImports;
  }

  return graph;
}

function resolveImportPath(importPath: string, fromFile: string): string | null {
  try {
    const resolved = path.resolve(path.dirname(fromFile), importPath);
    
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }

    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }

    const indexExtensions = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
    for (const ext of indexExtensions) {
      const withIndex = resolved + ext;
      if (fs.existsSync(withIndex)) {
        return withIndex;
      }
    }

    return null;
  } catch {
    return null;
  }
}

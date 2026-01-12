/**
 * Configuration loader and validator
 * Handles loading and validating architecture.yaml files
 */

import * as fs from "fs";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import { ArchitectureConfig, LayerConfig } from "./index";

export function loadArchitectureConfig(configPath: string): ArchitectureConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Architecture config not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, "utf-8");
  const parsed = parseYaml(content);

  return validateArchitectureConfig(parsed);
}

export function validateArchitectureConfig(config: any): ArchitectureConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Invalid architecture config: must be an object");
  }

  if (!config.layers || typeof config.layers !== "object") {
    throw new Error("Invalid architecture config: 'layers' must be an object");
  }

  const layers: Record<string, LayerConfig> = {};
  for (const [layerName, layerConfig] of Object.entries(config.layers)) {
    if (!layerConfig || typeof layerConfig !== "object") {
      throw new Error(`Invalid layer config for '${layerName}': must be an object`);
    }

    const layer = layerConfig as any;
    if (!Array.isArray(layer.allowedImports)) {
      throw new Error(`Invalid layer config for '${layerName}': 'allowedImports' must be an array`);
    }

    layers[layerName] = {
      allowedImports: layer.allowedImports,
    };
  }

  const rules = config.rules || {};

  return {
    layers,
    rules: {
      noBusinessLogicInComponents: rules.noBusinessLogicInComponents ?? false,
      noDataFetchingInUI: rules.noDataFetchingInUI ?? false,
      enforceFeatureBoundaries: rules.enforceFeatureBoundaries ?? false,
      noCircularLayerDeps: rules.noCircularLayerDeps ?? false,
    },
  };
}

export function findArchitectureConfig(startPath: string): string | null {
  let currentPath = path.resolve(startPath);

  while (currentPath !== path.dirname(currentPath)) {
    const configPath = path.join(currentPath, "architecture.yaml");
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

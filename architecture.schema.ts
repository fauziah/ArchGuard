/**
 * Architecture configuration schema
 * Defines the structure for architecture.yaml files
 */

export interface LayerConfig {
  allowedImports: string[];
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

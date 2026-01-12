/**
 * Cursor AI rules generator
 * Generates .cursor/AI_RULES.md based on architecture configuration
 */

import { ArchitectureConfig } from "@archguard/core";

export function generateCursorRules(architecture: ArchitectureConfig): string {
  const layers = Object.keys(architecture.layers);
  const layerDescriptions = layers
    .map((layer) => {
      const config = architecture.layers[layer];
      const allowed = config.allowedImports.length > 0 ? config.allowedImports.join(", ") : "none";
      return `- **${layer}**: Can import from: ${allowed}`;
    })
    .join("\n");

  const rules = [];
  if (architecture.rules.noBusinessLogicInComponents) {
    rules.push(
      "- **No business logic in components**: React components must not contain loops, complex conditionals, calculations, or data transformations. Extract these to the feature or domain layer."
    );
  }
  if (architecture.rules.noDataFetchingInUI) {
    rules.push(
      "- **No data fetching in UI**: UI components must not perform data fetching (fetch, axios, useEffect-based fetching). Move data fetching to the feature layer."
    );
  }
  if (architecture.rules.enforceFeatureBoundaries) {
    rules.push(
      "- **Enforce layer boundaries**: Respect the layer import rules. Do not create imports that violate the defined architecture."
    );
  }
  if (architecture.rules.noCircularLayerDeps) {
    rules.push(
      "- **No circular dependencies**: Do not create circular dependencies between layers."
    );
  }

  return `# Architecture Rules

This project uses archguard to enforce architecture boundaries. Follow these rules strictly.

## Layer Structure

${layerDescriptions}

## Rules

${rules.join("\n")}

## General Guidelines

- **Do not create new folders** without explicit justification
- **Do not merge layers** or blur boundaries
- **Explain violations** instead of generating invalid code
- **If unsure about architecture**, ask before making changes

## When AI Suggests Invalid Code

If you see a violation warning:
1. **Stop** and read the violation message
2. **Refactor** the code to follow the architecture
3. **Do not** suppress or ignore violations
4. **Explain** why the change is necessary if you must deviate

Remember: Architecture is fixed. Code must adapt to architecture, not the other way around.
`;
}

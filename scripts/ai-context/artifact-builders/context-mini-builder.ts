/**
 * Context Mini Builder - Generate ai-context-mini.json (lightweight version)
 * Task: T023
 * Path: scripts/ai-context/artifact-builders/context-mini-builder.ts
 */

import type { AIArchitectureBrain, AIContextMini } from '../../../packages/types/src/ai-context'

export async function buildContextMini(
  architectureBrain: AIArchitectureBrain
): Promise<AIContextMini> {
  // Organize modules by layer
  const modulesByLayer: AIContextMini['modules_by_layer'] = {}

  for (const [modulePath, module] of Object.entries(architectureBrain.modules)) {
    const layer = module.layer
    if (!modulesByLayer[layer]) {
      modulesByLayer[layer] = []
    }
    modulesByLayer[layer].push(modulePath)
  }

  // Extract rules, simplified
  const rules: AIContextMini['rules'] = {}
  for (const [layerName, rule] of Object.entries(architectureBrain.rules)) {
    rules[layerName] = {
      forbidden: rule.imports_forbidden || [],
    }
  }

  // Take only top 5 critical violations
  const criticalViolations = (architectureBrain.violations || []).slice(0, 5)

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    layers: architectureBrain.layers,
    modules_by_layer: modulesByLayer,
    rules,
    critical_violations: criticalViolations,
    full_context_url: 'docs/ai/context/',
    full_context_size_bytes: 15 * 1024 * 1024, // 15 MB estimate
  }
}

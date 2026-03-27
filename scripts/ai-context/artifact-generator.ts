/**
 * Artifact Generator Orchestrator - Coordinate all builders
 * @library-module
 * Task: T024
 * Path: scripts/ai-context/artifact-generator.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../utils/logger'
import { buildArchitectureBrain } from './artifact-builders/architecture-brain-builder'
import { buildArchitectureSummary } from './artifact-builders/architecture-summary-builder'
import { buildContextMini } from './artifact-builders/context-mini-builder'
import { buildDependencyGraph } from './artifact-builders/dependency-graph-builder'
import { buildLayerModel } from './artifact-builders/layer-model-builder'
import { buildModuleMap } from './artifact-builders/module-map-builder'
import { buildRuntimeMap } from './artifact-builders/runtime-map-builder'
import { validateAllArtifacts } from './schema-validator'
import { loadSourceMetadata } from './source-loader'
import type { GenerationError, GenerationResult } from './types'

export interface OrchestratorOptions {
  repoRoot: string
  outputDir: string
  validate?: boolean
  verbose?: boolean
}

export async function generateAllArtifacts(
  options: OrchestratorOptions
): Promise<GenerationResult> {
  const startTime = performance.now()
  const errors: GenerationError[] = []
  const warnings: GenerationError[] = []
  const artifacts: string[] = []

  try {
    // Step 1: Load source metadata
    if (options.verbose) log.info('Loading source metadata...')
    const metadata = await loadSourceMetadata(options.repoRoot)

    if (metadata.errors.length > 0) {
      warnings.push(...metadata.errors.filter((e) => e.severity === 'warning'))
      errors.push(...metadata.errors.filter((e) => e.severity === 'error'))
    }

    if (errors.length > 0 && errors.some((e) => e.severity === 'error')) {
      throw new Error('Critical errors in source metadata loading')
    }

    // Step 2: Build all artifacts in parallel
    if (options.verbose) log.info('Building artifacts in parallel...')
    const [moduleMap, layerModel, dependencyGraph, architectureSummary, runtimeMap] =
      await Promise.all([
        buildModuleMap(metadata),
        buildLayerModel(metadata),
        buildDependencyGraph(metadata),
        buildArchitectureSummary(metadata),
        buildRuntimeMap(metadata),
      ])

    // Step 3: Build architecture brain (depends on above results)
    if (options.verbose) log.info('Building architecture brain...')
    const architectureBrain = await buildArchitectureBrain(
      metadata,
      moduleMap,
      layerModel,
      dependencyGraph
    )

    // Step 4: Build context mini (depends on brain)
    if (options.verbose) log.info('Building lightweight context...')
    const contextMini = await buildContextMini(architectureBrain)

    // Step 5: Validate all artifacts
    if (options.validate) {
      if (options.verbose) log.info('Validating artifacts...')
      const validationResult = validateAllArtifacts({
        module_map: moduleMap,
        layer_model: layerModel,
        dependency_graph: dependencyGraph,
        runtime_map: runtimeMap,
        architecture_brain: architectureBrain,
        context_mini: contextMini,
      })

      if (!validationResult.all_valid) {
        for (const [name, result] of Object.entries(validationResult.results)) {
          if (!result.valid) {
            for (const err of result.errors) {
              errors.push({
                code: 'VALIDATION_FAILED',
                message: `${name}: ${err.message}`,
                context: { artifact: name, path: err.path },
                severity: 'error' as const,
              })
            }
          }
        }
      }
    }

    // Step 6: Write artifacts to output directory
    if (options.verbose) log.info('Writing artifacts...')
    await mkdir(options.outputDir, { recursive: true })

    const artifactData = {
      'ai-architecture-summary.md': architectureSummary,
      'ai-module-map.json': JSON.stringify(moduleMap, null, 2),
      'ai-layer-model.json': JSON.stringify(layerModel, null, 2),
      'ai-dependency-graph.json': JSON.stringify(dependencyGraph, null, 2),
      'ai-runtime-map.json': JSON.stringify(runtimeMap, null, 2),
      'ai-architecture-brain.json': JSON.stringify(architectureBrain, null, 2),
      'ai-context-mini.json': JSON.stringify(contextMini, null, 2),
    }

    for (const [filename, content] of Object.entries(artifactData)) {
      const filepath = join(options.outputDir, filename)
      await writeFile(filepath, content as string, 'utf-8')
      artifacts.push(filename)
      if (options.verbose) log.success(`  ${filename}`)
    }

    const duration = performance.now() - startTime

    return {
      success: errors.length === 0,
      artifacts_generated: artifacts,
      metrics: {
        total_modules: Object.keys(moduleMap.modules).length,
        total_violations: (dependencyGraph.violations || []).length,
        generation_time_ms: Math.round(duration),
        source_hash: metadata.sourceHash,
        source_timestamp: metadata.sourceTimestamp,
        generator_version: '1.0.0',
      },
      errors,
      warnings,
      duration_ms: Math.round(duration),
    }
  } catch (err) {
    const duration = performance.now() - startTime

    return {
      success: false,
      artifacts_generated: artifacts,
      metrics: {
        total_modules: 0,
        total_violations: 0,
        generation_time_ms: Math.round(duration),
        source_hash: 'unknown',
        source_timestamp: new Date().toISOString(),
        generator_version: '1.0.0',
      },
      errors: [
        ...errors,
        {
          code: 'GENERATION_FAILED',
          message: `Artifact generation failed: ${String(err)}`,
          context: { error: err },
          severity: 'error' as const,
        },
      ],
      warnings,
      duration_ms: Math.round(duration),
    }
  }
}

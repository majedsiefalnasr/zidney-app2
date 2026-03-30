#!/usr/bin/env bun

/**
 * @script arch:validate:brain
 * @domain arch
 * @category governance
 * @description Validate the architecture brain artifact structure and dependency paths before it is committed or consumed.
 * @usage bun run arch:validate:brain
 */

/**
 * Architecture Brain Validator — Refactored Entry Point
 *
 * Validates that ai-architecture-brain.json has correct structure and valid dependency paths.
 * Prevents corrupt brains from being committed to the repository.
 *
 * T034 — Refactored to use:
 * - artifact-validator (validate architecture brain artifact)
 * - performance-profiler (measure execution time)
 * - logger-factory (structured output)
 *
 * Phase 2: Script Modularization — Governance Tools
 *
 * Exit codes:
 * - 0: Brain is valid
 * - 1: Brain has errors (fatal)
 * - 2: Brain has warnings (non-fatal, but logged)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateArtifactContent } from '../core/artifact-validator'
import { Timer } from '../core/performance-profiler'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'

const logger = createLogger('validate-architecture-brain')
logger.setContext({ ci: hasCiFlag(process.argv.slice(2)) })

const ROOT = process.cwd()
const BRAIN_PATH = join(ROOT, 'docs', 'ai', 'context', 'ai-architecture-brain.json')
const BOUNDARIES_PATH = join(ROOT, 'docs', 'architecture', 'module-boundaries.json')

interface ArchitectureBrainEdge {
  from?: string
  to?: string
}

interface ArchitectureBrain {
  modules?: unknown
  edges?: ArchitectureBrainEdge[]
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    modules: number
    edges: number
    malformedEdges: number
  }
  executionTimeMs: number
}

function isValidModulePath(path: string | undefined): boolean {
  if (!path) return false
  const parts = path.split('/')
  return (
    parts.length === 2 && (parts[0] === 'packages' || parts[0] === 'apps') && parts[1].length > 0
  )
}

function validateBrain(): ValidationResult {
  const timer = new Timer()

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      modules: 0,
      edges: 0,
      malformedEdges: 0,
    },
    executionTimeMs: 0,
  }

  const extraWarnings: string[] = []

  try {
    // Check file exists
    if (!existsSync(BRAIN_PATH)) {
      result.errors.push(`Brain file not found at ${BRAIN_PATH}`)
      result.valid = false
      result.executionTimeMs = timer.end()
      return result
    }

    // Load and parse brain
    let brain: unknown
    try {
      const raw = readFileSync(BRAIN_PATH, 'utf-8')
      brain = JSON.parse(raw)
    } catch (err) {
      result.errors.push(
        `Failed to parse brain JSON: ${err instanceof Error ? err.message : String(err)}`
      )
      result.valid = false
      result.executionTimeMs = timer.end()
      return result
    }

    const brainObj = brain as ArchitectureBrain | undefined

    // Deduplicate edges in-place if duplicates exist (auto-fix)
    try {
      if (brainObj && Array.isArray(brainObj.edges)) {
        const originalEdges = brainObj.edges as ArchitectureBrainEdge[]
        const edgeMap = new Map<string, ArchitectureBrainEdge>()
        for (const e of originalEdges) {
          if (!e || typeof e !== 'object') continue
          const key = `${e.from}-->${e.to}`
          if (!edgeMap.has(key)) edgeMap.set(key, e)
        }
        const uniqueEdges = Array.from(edgeMap.values())
        if (uniqueEdges.length !== originalEdges.length) {
          const newBrain = { ...(brain as Record<string, unknown>), edges: uniqueEdges }
          try {
            writeFileSync(BRAIN_PATH, `${JSON.stringify(newBrain, null, 2)}\n`, 'utf-8')
            extraWarnings.push(
              `Deduplicated ${originalEdges.length - uniqueEdges.length} duplicate edges and updated brain file`
            )
            // update in-memory reference
            brainObj.edges = uniqueEdges
          } catch (writeErr) {
            extraWarnings.push(`Failed to write deduplicated brain file: ${String(writeErr)}`)
          }
        }
      }
    } catch (dedupeErr) {
      // non-fatal
      result.warnings.push(`Edge deduplication encountered an error: ${String(dedupeErr)}`)
    }

    // Validate schema using artifact validator
    const schemaValid = validateArtifactContent(brainObj, 'ai-architecture-brain')
    if (!schemaValid) {
      result.errors.push('Brain failed schema validation (see artifact validator)')
      result.valid = false
    }

    // Validate core fields
    if (!brainObj?.modules) {
      result.errors.push('Brain missing "modules" field')
      result.valid = false
    }

    if (!Array.isArray(brainObj?.edges)) {
      result.errors.push('Brain missing "edges" field or it\'s not an array')
      result.valid = false
      result.executionTimeMs = timer.end()
      return result
    }

    // Count modules
    if (brainObj?.modules) {
      const modulesVal = brainObj.modules
      result.stats.modules = Array.isArray(modulesVal)
        ? modulesVal.length
        : Object.keys(modulesVal as Record<string, unknown>).length
    }

    result.stats.edges = Array.isArray(brainObj?.edges) ? (brainObj?.edges as unknown[]).length : 0

    // Load boundaries for reference validation
    let boundaries: unknown = null
    if (existsSync(BOUNDARIES_PATH)) {
      try {
        boundaries = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
      } catch {
        result.warnings.push('Could not load module-boundaries.json for reference validation')
      }
    }

    const declaredModules = new Set<string>()
    if (
      boundaries &&
      typeof boundaries === 'object' &&
      'layers' in boundaries &&
      typeof boundaries.layers === 'object'
    ) {
      for (const modules of Object.values(boundaries.layers as Record<string, unknown>)) {
        if (Array.isArray(modules)) {
          for (const m of modules) {
            if (typeof m === 'string') {
              declaredModules.add(m)
            }
          }
        }
      }
    }

    // Validate each edge
    const validatedEdges = new Set<string>()
    const seenFromEdges = new Map<string, number>()

    for (const edge of brainObj?.edges || []) {
      if (!edge.from || !edge.to) {
        result.errors.push(`Edge with missing from/to: ${JSON.stringify(edge)}`)
        result.stats.malformedEdges++
        result.valid = false
        continue
      }

      const edgeKey = `${edge.from}->${edge.to}`

      // Check for duplicate edges
      if (validatedEdges.has(edgeKey)) {
        result.warnings.push(`Duplicate edge: ${edgeKey}`)
        continue
      }
      validatedEdges.add(edgeKey)

      // Validate from is a proper module path
      if (!isValidModulePath(edge.from)) {
        result.errors.push(
          `Edge has invalid source module: "${edge.from}" (not a valid monorepo module path). Edge: ${edgeKey}`
        )
        result.stats.malformedEdges++
        result.valid = false
        continue
      }

      // Check if source module is declared
      if (declaredModules.size > 0 && !declaredModules.has(edge.from)) {
        result.warnings.push(
          `Edge source "${edge.from}" is not declared in module-boundaries.json (may be undeclared). Edge: ${edgeKey}`
        )
      }

      // Validate to is a proper module path
      if (!isValidModulePath(edge.to)) {
        result.errors.push(
          `Edge has invalid target module: "${edge.to}" (not a valid monorepo module path). Edge: ${edgeKey}`
        )
        result.stats.malformedEdges++
        result.valid = false
        continue
      }

      // Check if target module is declared
      if (declaredModules.size > 0 && !declaredModules.has(edge.to)) {
        result.warnings.push(
          `Edge target "${edge.to}" is not declared in module-boundaries.json (may be undeclared). Edge: ${edgeKey}`
        )
      }

      // Track edges per source
      seenFromEdges.set(edge.from, (seenFromEdges.get(edge.from) || 0) + 1)
    }

    // Check for suspiciously high edge counts (possible corruption)
    for (const [module, count] of Array.from(seenFromEdges.entries())) {
      if (count > 50) {
        result.warnings.push(
          `Module "${module}" has ${count} outgoing dependencies (unusually high, may indicate corruption)`
        )
      }
    }

    // Check for path-like patterns that shouldn't exist
    for (const edge of brainObj?.edges || []) {
      // Should never have edges with './' prefix
      if (edge.from?.startsWith('./') || edge.to?.startsWith('./')) {
        result.errors.push(
          `Edge contains relative path prefix (./) - should be absolute: ${edge.from}->${edge.to}`
        )
        result.valid = false
      }

      // Should never have paths with src/ or dist/ in the module path (only apps/<name> or packages/<name>)
      const fromParts = edge.from?.split('/') || []
      const toParts = edge.to?.split('/') || []

      if (fromParts.length > 2) {
        result.errors.push(
          `Edge source has too many segments (expected apps/<name> or packages/<name>): ${edge.from}`
        )
        result.stats.malformedEdges++
        result.valid = false
      }

      if (toParts.length > 2) {
        result.errors.push(
          `Edge target has too many segments (expected apps/<name> or packages/<name>): ${edge.to}`
        )
        result.stats.malformedEdges++
        result.valid = false
      }
    }

    result.executionTimeMs = timer.end()
    // Merge any extra warnings collected during auto-fix steps
    result.warnings = Array.isArray(result.warnings)
      ? result.warnings.concat(extraWarnings)
      : extraWarnings
  } catch (error) {
    logger.error('Validation error', { error: String(error) })
    result.errors.push(`Unexpected validation error: ${String(error)}`)
    result.valid = false
    result.executionTimeMs = timer.end()
  }

  return result
}

// Main execution
const result = validateBrain()
log.header(
  'VALIDATE ARCHITECTURE BRAIN',
  'Validates ai-architecture-brain.json structure and dependency paths'
)
// Simple health evaluation based on execution time (ms)
let health: 'PASS' | 'WARN' | 'FAIL' = 'PASS'
if (result.executionTimeMs > 2000) {
  health = 'FAIL'
} else if (result.executionTimeMs > 1000) {
  health = 'WARN'
} else {
  health = 'PASS'
}

logger.info('Architecture brain validation completed', {
  valid: result.valid,
  errors: result.errors.length,
  warnings: result.warnings.length,
  modules: result.stats.modules,
  edges: result.stats.edges,
  malformed_edges: result.stats.malformedEdges,
  execution_time_ms: result.executionTimeMs,
  health: health,
})

if (result.errors.length > 0) {
  log.error('[VALIDATE BRAIN] ERRORS DETECTED:')
  for (const err of result.errors) {
    log.error(`  ${err}`)
  }
}

if (result.warnings.length > 0) {
  log.warn('[VALIDATE BRAIN] WARNINGS:')
  for (const warn of result.warnings) {
    log.warn(`  ${warn}`)
  }
}

log.info(`[VALIDATE BRAIN] Statistics:`)
log.step(`Modules: ${result.stats.modules}`)
log.step(`Edges: ${result.stats.edges}`)
log.step(`Malformed Edges: ${result.stats.malformedEdges}`)
log.step(`Execution Time: ${result.executionTimeMs}ms`)
log.step(`Health: ${health}`)

if (!result.valid) {
  log.error('[VALIDATE BRAIN] VALIDATION FAILED')
  log.result({
    total: result.stats.modules,
    passed: 0,
    failed: result.errors.length,
    message: 'Brain validation failed.',
  })
  exit(1)
}

if (result.warnings.length > 0) {
  log.warn('[VALIDATE BRAIN] VALIDATION PASSED WITH WARNINGS (non-fatal)')
  log.result({
    total: result.stats.modules,
    passed: result.stats.modules,
    failed: 0,
    message: `Passed with ${result.warnings.length} warning(s).`,
  })
  exit(0)
}

log.success('[VALIDATE BRAIN] VALIDATION PASSED')
log.result({
  total: result.stats.modules,
  passed: result.stats.modules,
  failed: 0,
  message: 'Brain validation passed.',
})
exit(0)

// Exports for testing
export { validateBrain }

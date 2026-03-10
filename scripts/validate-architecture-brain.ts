#!/usr/bin/env bun
/**
 * Architecture Brain Validator
 *
 * Purpose:
 * Validate that ai-architecture-brain.json has correct structure and valid dependency paths.
 * Prevents corrupt brains from being committed to the repository.
 *
 * This script is run:
 * - In pre-commit hooks (when docs/ai/context/ changes)
 * - In CI/CD pipelines
 * - By the orchestrator before committing architecture changes
 *
 * Exit codes:
 * - 0: Brain is valid
 * - 1: Brain has errors (fatal)
 * - 2: Brain has warnings (non-fatal, but logged)
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const BRAIN_PATH = join(ROOT, 'docs', 'ai', 'context', 'ai-architecture-brain.json')
const BOUNDARIES_PATH = join(ROOT, 'docs', 'architecture', 'module-boundaries.json')

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    modules: number
    edges: number
    malformedEdges: number
  }
}

function isValidModulePath(path: string | undefined): boolean {
  if (!path) return false
  const parts = path.split('/')
  return (
    parts.length === 2 && (parts[0] === 'packages' || parts[0] === 'apps') && parts[1].length > 0
  )
}

function validateBrain(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      modules: 0,
      edges: 0,
      malformedEdges: 0,
    },
  }

  // Check file exists
  if (!existsSync(BRAIN_PATH)) {
    result.errors.push(`Brain file not found at ${BRAIN_PATH}`)
    result.valid = false
    return result
  }

  // Load and parse brain
  let brain: any
  try {
    const raw = readFileSync(BRAIN_PATH, 'utf-8')
    brain = JSON.parse(raw)
  } catch (err) {
    result.errors.push(
      `Failed to parse brain JSON: ${err instanceof Error ? err.message : String(err)}`
    )
    result.valid = false
    return result
  }

  // Validate schema
  if (!brain.modules) {
    result.errors.push('Brain missing "modules" field')
    result.valid = false
  }

  if (!Array.isArray(brain.edges)) {
    result.errors.push('Brain missing "edges" field or it\'s not an array')
    result.valid = false
    return result
  }

  // Count modules
  if (brain.modules) {
    result.stats.modules = Array.isArray(brain.modules)
      ? brain.modules.length
      : Object.keys(brain.modules).length
  }

  result.stats.edges = brain.edges.length

  // Load boundaries for reference
  let boundaries: any = null
  if (existsSync(BOUNDARIES_PATH)) {
    try {
      boundaries = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
    } catch {
      result.warnings.push('Could not load module-boundaries.json for reference validation')
    }
  }

  const declaredModules = new Set<string>()
  if (boundaries?.layers) {
    for (const modules of Object.values(boundaries.layers)) {
      if (Array.isArray(modules)) {
        for (const m of modules) {
          declaredModules.add(m)
        }
      }
    }
  }

  // Validate each edge
  const validatedEdges = new Set<string>()
  const seenFromEdges = new Map<string, number>()

  for (const edge of brain.edges) {
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
  for (const [module, count] of seenFromEdges.entries()) {
    if (count > 50) {
      result.warnings.push(
        `Module "${module}" has ${count} outgoing dependencies (unusually high, may indicate corruption)`
      )
    }
  }

  // Check for path-like patterns that shouldn't exist
  for (const edge of brain.edges) {
    // Should never have edges with './  prefix
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

  return result
}

// Main execution
const result = validateBrain()

if (result.errors.length > 0) {
  console.error('\n[VALIDATE BRAIN] ❌ ERRORS DETECTED:\n')
  for (const err of result.errors) {
    console.error(`  ❌ ${err}`)
  }
}

if (result.warnings.length > 0) {
  console.warn('\n[VALIDATE BRAIN] ⚠️  WARNINGS:\n')
  for (const warn of result.warnings) {
    console.warn(`  ⚠️  ${warn}`)
  }
}

console.log(`\n[VALIDATE BRAIN] Statistics:`)
console.log(`  Modules: ${result.stats.modules}`)
console.log(`  Edges: ${result.stats.edges}`)
console.log(`  Malformed Edges: ${result.stats.malformedEdges}`)

if (!result.valid) {
  console.error('\n[VALIDATE BRAIN] ❌ VALIDATION FAILED\n')
  process.exit(1)
}

if (result.warnings.length > 0) {
  console.log('\n[VALIDATE BRAIN] ⚠️  VALIDATION PASSED WITH WARNINGS\n')
  process.exit(2)
}

console.log('\n[VALIDATE BRAIN] ✅ VALIDATION PASSED\n')
process.exit(0)

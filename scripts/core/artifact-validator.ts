/**
 * Artifact Validator Utility
 *
 * Purpose: Validate AI context artifacts and architecture intelligence
 * Used by: validate-architecture-brain, ai-guard, infra-audit
 *
 * Provides:
 * - Artifact integrity checking
 * - Schema validation for all artifact types
 * - Freshness validation
 
 * @library-module
*/

import { readFileSync } from 'node:fs'
import {
  type ValidationResult,
  validateArchitectureBrain,
  validateDependencyGraph,
} from './schema-validator'

export type ArtifactType =
  | 'ai-context-mini'
  | 'ai-module-map'
  | 'ai-dependency-graph'
  | 'ai-architecture-brain'
  | 'ai-runtime-dependents'
  | 'ai-layer-model'
  | 'ai-runtime-map'
  | 'ai-architecture-summary'

export interface ArtifactValidationResult {
  artifact: ArtifactType
  isValid: boolean
  timestamp: number
  schemaValid: boolean
  schemaErrors?: string[]
  contentValid: boolean
  contentErrors?: string[]
  sizeBytes: number
  compressionRatio?: number
  isFresh: boolean
  sourceFilesHash?: string
  detailedChecks?: Record<string, unknown>
}

/**
 * Validate a JSON artifact file
 */
export function validateArtifactFile(
  filePath: string,
  artifactType: ArtifactType
): ArtifactValidationResult {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const sizeBytes = content.length
    const data = JSON.parse(content)

    let schemaResult: ValidationResult | null = null

    // Validate based on artifact type
    switch (artifactType) {
      case 'ai-dependency-graph':
        schemaResult = validateDependencyGraph(data)
        break
      case 'ai-architecture-brain':
        schemaResult = validateArchitectureBrain(data)
        break
      case 'ai-module-map':
      case 'ai-runtime-map':
      case 'ai-runtime-dependents':
      case 'ai-layer-model':
        // Basic object validation for these
        schemaResult = {
          valid: typeof data === 'object' && data !== null,
          errors: [],
          warnings: [],
        }
        break
      default:
        schemaResult = {
          valid: typeof data === 'object' && data !== null,
          errors: [],
          warnings: [],
        }
    }

    const schemaValid = schemaResult.valid
    const schemaErrors = schemaResult.errors.map((e) => `${e.path}: ${e.message}`)

    // Content validation
    const contentValid = validateArtifactContent(data, artifactType)
    const contentErrors = contentValid ? [] : [`Content validation failed for ${artifactType}`]

    // Freshness check (rough heuristic: has recent timestamp)
    const isFresh = data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000

    return {
      artifact: artifactType,
      isValid: schemaValid && contentValid,
      timestamp: Date.now(),
      schemaValid,
      schemaErrors,
      contentValid,
      contentErrors,
      sizeBytes,
      isFresh,
    }
  } catch (error) {
    return {
      artifact: artifactType,
      isValid: false,
      timestamp: Date.now(),
      schemaValid: false,
      schemaErrors: [(error as Error).message],
      contentValid: false,
      contentErrors: ['Failed to parse artifact'],
      sizeBytes: 0,
      isFresh: false,
    }
  }
}

/**
 * Validate artifact-specific content
 */
export function validateArtifactContent(data: unknown, artifactType: ArtifactType): boolean {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  switch (artifactType) {
    case 'ai-dependency-graph': {
      // Must have edges array and modules array
      return (
        Array.isArray(obj.edges) &&
        Array.isArray(obj.modules) &&
        obj.edges.every((e: unknown) => {
          if (typeof e !== 'object' || e === null) return false
          const edge = e as Record<string, unknown>
          return typeof edge.from === 'string' && typeof edge.to === 'string'
        })
      )
    }
    case 'ai-architecture-brain': {
      // Must have modules and edges
      return Array.isArray(obj.modules) && Array.isArray(obj.edges)
    }
    default:
      // Basic object check
      return Object.keys(obj).length > 0
  }
}

/**
 * Validate multiple artifacts
 */
export function validateArtifacts(
  artifacts: Array<{ filePath: string; type: ArtifactType }>
): ArtifactValidationResult[] {
  return artifacts.map((artifact) => validateArtifactFile(artifact.filePath, artifact.type))
}

/**
 * Check if all artifacts are valid
 */
export function allArtifactsValid(results: ArtifactValidationResult[]): boolean {
  return results.every((result) => result.isValid)
}

/**
 * Generate artifact validation report
 */
export function generateValidationReport(results: ArtifactValidationResult[]): string {
  const lines: string[] = ['Artifact Validation Report', '='.repeat(50)]

  let passCount = 0
  let failCount = 0

  for (const result of results) {
    const status = result.isValid ? '✓ PASS' : '✗ FAIL'
    lines.push(`${status} ${result.artifact} (${(result.sizeBytes / 1024).toFixed(1)}KB)`)

    if (!result.isValid) {
      failCount++
      if (result.schemaErrors && result.schemaErrors.length > 0) {
        lines.push(`  Schema errors: ${result.schemaErrors.join(', ')}`)
      }
      if (result.contentErrors && result.contentErrors.length > 0) {
        lines.push(`  Content errors: ${result.contentErrors.join(', ')}`)
      }
    } else {
      passCount++
    }
  }

  lines.push('')
  lines.push(`Summary: ${passCount} passed, ${failCount} failed`)

  return lines.join('\n')
}

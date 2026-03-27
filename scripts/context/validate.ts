#!/usr/bin/env bun
/**
 * @script arch:context:validate
 * @domain arch
 * @category governance
 * @description Validates docs/ai/context/gitnexus-context.json against
 *   docs/ai/gitnexus-context.schema.json. No external schema library (NFR-005).
 *
 *   Validation order (stops at first failure):
 *   1. Artifact file exists
 *   2. Valid JSON
 *   3. Schema file exists and is readable
 *   4. All required fields present
 *   5. schemaVersion matches schema.version
 *   6. generatedAt is < maxAgeHours old (default: 24h)
 *
 * @usage bun run arch:context:validate
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushAi, log } from '../utils/logger'

const DEFAULT_ARTIFACT_PATH = resolve('docs/ai/context/gitnexus-context.json')
const DEFAULT_SCHEMA_PATH = resolve('docs/ai/gitnexus-context.schema.json')

export const MAX_AGE_HOURS = 24

export interface ValidateOptions {
  artifactPath?: string
  schemaPath?: string
  maxAgeHours?: number
}

/**
 * Validates the gitnexus context artifact.
 * @returns OK message string on success.
 * @throws Error with a descriptive message on any validation failure.
 */
export function validateArtifact(options: ValidateOptions = {}): string {
  const artifactPath = options.artifactPath ?? DEFAULT_ARTIFACT_PATH
  const schemaPath = options.schemaPath ?? DEFAULT_SCHEMA_PATH
  const maxAgeHours = options.maxAgeHours ?? MAX_AGE_HOURS

  // 1. Artifact file exists
  if (!existsSync(artifactPath)) {
    throw new Error(`artifact not found — run 'bun run arch:context:build' first: ${artifactPath}`)
  }

  // 2. Valid JSON
  let artifact: Record<string, unknown>
  try {
    artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as Record<string, unknown>
  } catch (err) {
    throw new Error(`invalid JSON in artifact: ${String(err)}`)
  }

  // 3. Schema file exists
  if (!existsSync(schemaPath)) {
    throw new Error(`schema not found: ${schemaPath}`)
  }

  let schema: { required?: string[]; version?: string }
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
      required?: string[]
      version?: string
    }
  } catch (err) {
    throw new Error(`invalid JSON in schema: ${String(err)}`)
  }

  // 4. Required fields present
  const required: string[] = schema.required ?? []
  for (const field of required) {
    if (artifact[field] === undefined) {
      throw new Error(`missing required field: ${field}`)
    }
  }

  // 5. schemaVersion matches schema.version
  const expectedVersion = schema.version
  if (expectedVersion !== undefined && artifact.schemaVersion !== expectedVersion) {
    throw new Error(
      `schemaVersion mismatch — artifact: ${String(artifact.schemaVersion)}, schema: ${expectedVersion}`
    )
  }

  // 6. Freshness check — generatedAt must be < maxAgeHours old
  const generatedAtRaw = artifact.generatedAt
  if (typeof generatedAtRaw !== 'string') {
    throw new Error(`'generatedAt' is not a string`)
  }
  const generatedAt = new Date(generatedAtRaw)
  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error(`'generatedAt' is not a valid ISO 8601 timestamp: '${generatedAtRaw}'`)
  }
  const ageMs = Date.now() - generatedAt.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours >= maxAgeHours) {
    const ageDisplay = ageHours.toFixed(1)
    throw new Error(
      `stale artifact — age: ${ageDisplay}h (max: ${maxAgeHours}h) — run 'bun run arch:context:build --force'`
    )
  }

  const ageDisplay = ageHours.toFixed(1)
  return `[context:validate] OK artifact valid (schemaVersion=${String(artifact.schemaVersion)}, age=${ageDisplay}h)`
}

function main(): void {
  log.header('CONTEXT VALIDATE', 'Validates gitnexus-context.json against schema')
  try {
    const msg = validateArtifact()
    log.success(msg)
    log.result({ total: 1, passed: 1, failed: 0 })
    flushAi()
    process.exit(0)
  } catch (err) {
    log.error(`[context:validate] FAIL: ${err instanceof Error ? err.message : String(err)}`)
    log.result({ total: 1, passed: 0, failed: 1 })
    flushAi()
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}

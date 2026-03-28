/** @library-module */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_AGE_HOURS, validateArtifact } from '../validate.ts'

/**
 * Unit tests for scripts/context/validate.ts — validateArtifact()
 *
 * Covers all 6 validation checks using real temp files (no module mocking):
 *   1. Artifact file exists
 *   2. Artifact contains valid JSON
 *   3. Schema file exists
 *   4. All required fields present
 *   5. schemaVersion matches schema version
 *   6. generatedAt within maxAgeHours
 */

// ── Shared test helpers ──────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  'schemaVersion',
  'generatedAt',
  'analysisMode',
  'changedFiles',
  'impactedModules',
  'dependencyGraph',
  'architectureLayerMap',
  'recentCommits',
  'riskIndicators',
] as const

const SCHEMA_VERSION = '1.0.0'

function freshTimestamp(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString()
}

function validArtifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: freshTimestamp(60 * 60 * 1000), // 1 hour old — safely within 24 h
    analysisMode: 'full',
    changedFiles: [],
    impactedModules: [],
    dependencyGraph: {},
    architectureLayerMap: {},
    recentCommits: [],
    riskIndicators: [],
  }
  return { ...base, ...overrides }
}

function validSchema(): { version: string; required: string[] } {
  return { version: SCHEMA_VERSION, required: [...REQUIRED_FIELDS] }
}

function writePair(
  dir: string,
  artifact: Record<string, unknown>,
  schema = validSchema()
): { artifactPath: string; schemaPath: string } {
  const artifactPath = join(dir, 'gitnexus-context.json')
  const schemaPath = join(dir, 'gitnexus-context.schema.json')
  writeFileSync(artifactPath, JSON.stringify(artifact))
  writeFileSync(schemaPath, JSON.stringify(schema))
  return { artifactPath, schemaPath }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('context:validate — validateArtifact()', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'context-validate-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns OK string for a valid fresh artifact', () => {
    const { artifactPath, schemaPath } = writePair(tmpDir, validArtifact())
    const result = validateArtifact({ artifactPath, schemaPath })
    expect(result).toMatch(/^\[context:validate\] OK artifact valid/)
    expect(result).toContain(`schemaVersion=${SCHEMA_VERSION}`)
  })

  it('throws "artifact not found" when artifact file is missing', () => {
    const artifactPath = join(tmpDir, 'missing.json')
    const schemaPath = join(tmpDir, 'schema.json')
    expect(() => validateArtifact({ artifactPath, schemaPath })).toThrow('artifact not found')
  })

  it('throws "invalid JSON in artifact" when artifact is malformed JSON', () => {
    const artifactPath = join(tmpDir, 'gitnexus-context.json')
    writeFileSync(artifactPath, '{ broken json :::')
    const schemaPath = join(tmpDir, 'schema.json')
    writeFileSync(schemaPath, JSON.stringify(validSchema()))
    expect(() => validateArtifact({ artifactPath, schemaPath })).toThrow('invalid JSON in artifact')
  })

  it.each(REQUIRED_FIELDS)('throws "missing required field: %s" when field is absent', (field) => {
    const artifact = validArtifact()
    delete artifact[field]
    const { artifactPath, schemaPath } = writePair(tmpDir, artifact)
    expect(() => validateArtifact({ artifactPath, schemaPath })).toThrow(
      `missing required field: ${field}`
    )
  })

  it('throws "schemaVersion mismatch" when artifact version differs from schema', () => {
    const artifact = validArtifact({ schemaVersion: '0.9.0' })
    const { artifactPath, schemaPath } = writePair(tmpDir, artifact)
    expect(() => validateArtifact({ artifactPath, schemaPath })).toThrow('schemaVersion mismatch')
  })

  it('throws "stale artifact" when artifact is 25h old', () => {
    const artifact = validArtifact({ generatedAt: freshTimestamp(25 * 60 * 60 * 1000) })
    const { artifactPath, schemaPath } = writePair(tmpDir, artifact)
    expect(() => validateArtifact({ artifactPath, schemaPath })).toThrow('stale artifact')
  })

  it('returns OK when artifact is just under maxAgeHours (23 h 59 m)', () => {
    const offsetMs = (MAX_AGE_HOURS * 60 - 1) * 60 * 1000
    const artifact = validArtifact({ generatedAt: freshTimestamp(offsetMs) })
    const { artifactPath, schemaPath } = writePair(tmpDir, artifact)
    const result = validateArtifact({ artifactPath, schemaPath })
    expect(result).toMatch(/^\[context:validate\] OK/)
  })

  it('throws "stale artifact" when artifact is just over maxAgeHours (24 h 1 m)', () => {
    const offsetMs = (MAX_AGE_HOURS * 60 + 1) * 60 * 1000
    const artifact = validArtifact({ generatedAt: freshTimestamp(offsetMs) })
    const { artifactPath, schemaPath } = writePair(tmpDir, artifact)
    expect(() => validateArtifact({ artifactPath, schemaPath })).toThrow('stale artifact')
  })
})

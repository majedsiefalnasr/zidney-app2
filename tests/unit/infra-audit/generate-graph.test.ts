/**
 * Integration tests for generateDependencyGraph() in infra-audit.ts
 *
 * Stage: STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD — T018
 *
 * Runs the real function against the actual repository and verifies:
 * - Output file is created and parseable
 * - schema_version === "2"
 * - generated_at is a valid ISO-8601 string
 * - source_metadata.infra_audit_timestamp is a valid ISO-8601 string
 * - modules keys match the ARCHITECTURE_MAP module count
 * - All dependency entries reference valid module keys
 * - reverse_dependencies contains no duplicates per key
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'

import type { AIDependencyGraph } from '../../../packages/types/src/ai-context'
import { generateDependencyGraph } from '../../../scripts/infra-audit'

const GRAPH_PATH = 'docs/ai/context/ai-dependency-graph.json'

// Backup original content so the production artifact is restored after this test suite
const _originalGraphContent = existsSync(GRAPH_PATH) ? readFileSync(GRAPH_PATH, 'utf-8') : null

describe('generateDependencyGraph() — T018', () => {
  // Restore original file after all tests so the full suite isn't affected.
  afterAll(() => {
    if (_originalGraphContent !== null) {
      writeFileSync(GRAPH_PATH, _originalGraphContent, 'utf-8')
    } else if (existsSync(GRAPH_PATH)) {
      rmSync(GRAPH_PATH)
    }
  })

  let graph: AIDependencyGraph | null = null

  it('creates docs/ai/context/ai-dependency-graph.json without throwing', () => {
    // Clean slate
    if (existsSync(GRAPH_PATH)) rmSync(GRAPH_PATH)
    expect(() => generateDependencyGraph()).not.toThrow()
    expect(existsSync(GRAPH_PATH)).toBe(true)
  })

  it('output is parseable JSON conforming to AIDependencyGraph', () => {
    expect(existsSync(GRAPH_PATH)).toBe(true)
    const raw = readFileSync(GRAPH_PATH, 'utf-8')
    expect(() => {
      graph = JSON.parse(raw) as AIDependencyGraph
    }).not.toThrow()
    expect(graph).not.toBeNull()
  })

  it('schema_version is "2"', () => {
    graph ??= JSON.parse(readFileSync(GRAPH_PATH, 'utf-8')) as AIDependencyGraph
    expect(graph.schema_version).toBe('2')
  })

  it('generated_at is a valid ISO-8601 string', () => {
    graph ??= JSON.parse(readFileSync(GRAPH_PATH, 'utf-8')) as AIDependencyGraph
    expect(typeof graph.generated_at).toBe('string')
    const d = Date.parse(graph.generated_at as string)
    expect(Number.isNaN(d)).toBe(false)
  })

  it('source_metadata.infra_audit_timestamp is a valid ISO-8601 string', () => {
    graph ??= JSON.parse(readFileSync(GRAPH_PATH, 'utf-8')) as AIDependencyGraph
    const ts = graph.source_metadata?.infra_audit_timestamp
    expect(typeof ts).toBe('string')
    expect(Number.isNaN(Date.parse(ts as string))).toBe(false)
  })

  it('modules object is present and has at least 14 entries (all ARCHITECTURE_MAP modules)', () => {
    graph ??= JSON.parse(readFileSync(GRAPH_PATH, 'utf-8')) as AIDependencyGraph
    expect(typeof graph.modules).toBe('object')
    expect(graph.modules).not.toBeNull()
    // ARCHITECTURE_MAP.json declares 14 modules.
    expect(Object.keys(graph.modules).length).toBeGreaterThanOrEqual(14)
  })

  it('all dependency entries inside modules reference valid module keys', () => {
    graph ??= JSON.parse(readFileSync(GRAPH_PATH, 'utf-8')) as AIDependencyGraph
    const modKeys = new Set(Object.keys(graph.modules))
    for (const [modulePath, info] of Object.entries(graph.modules)) {
      for (const dep of info.dependencies ?? []) {
        expect(modKeys.has(dep), `${modulePath} → unknown dep "${dep}"`).toBe(true)
      }
    }
  })

  it('reverse_dependencies has no duplicate entries per key', () => {
    graph ??= JSON.parse(readFileSync(GRAPH_PATH, 'utf-8')) as AIDependencyGraph
    for (const [key, dependents] of Object.entries(graph.reverse_dependencies ?? {})) {
      const asList = dependents as string[]
      const unique = new Set(asList)
      expect(unique.size, `reverse_dependencies["${key}"] contains duplicates`).toBe(asList.length)
    }
  })
})

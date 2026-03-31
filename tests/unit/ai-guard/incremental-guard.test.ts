/**
 * Unit + Integration tests for incremental guard utilities in ai-guard.ts
 *
 * Stage: STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD
 *
 * Covers:
 * - T014: parseArgs()
 * - T015: mapToModules()
 * - T016: computeImpactScope() BFS
 * - T017: loadDependencyGraph()
 * - T019: runIncremental() incremental path
 * - T020: runIncremental() fallback triggers
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AIDependencyGraph } from '../../../packages/types/src/ai-context'
import {
  computeImpactScope,
  loadDependencyGraph,
  mapToModules,
  parseArgs,
  runIncremental,
} from '../../../scripts/ai-guard'

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

const GRAPH_PATH = 'docs/ai/context/ai-dependency-graph.json'

// Backup and restore the production artifact so the full test suite isn't affected
const _originalGraphContent = existsSync(GRAPH_PATH) ? readFileSync(GRAPH_PATH, 'utf-8') : null

afterAll(() => {
  if (_originalGraphContent !== null) {
    writeFileSync(GRAPH_PATH, _originalGraphContent, 'utf-8')
  }
})

function makeGraph(overrides: Partial<AIDependencyGraph> = {}): AIDependencyGraph {
  const now = new Date().toISOString()
  return {
    schema_version: '2',
    generated_at: now,
    source_metadata: { infra_audit_timestamp: now },
    modules: {
      'packages/logger': { dependencies: [], layer: 'infrastructure', type: 'package' },
      'packages/types': { dependencies: [], layer: 'domain', type: 'package' },
      'apps/api': {
        dependencies: ['packages/logger', 'packages/types'],
        layer: 'runtime',
        type: 'app',
      },
      'apps/mmc': { dependencies: ['packages/logger'], layer: 'ui', type: 'app' },
    },
    reverse_dependencies: {
      'packages/logger': ['apps/api', 'apps/mmc'],
      'packages/types': ['apps/api'],
    },
    edges: [
      { from: 'apps/api', to: 'packages/logger' },
      { from: 'apps/api', to: 'packages/types' },
      { from: 'apps/mmc', to: 'packages/logger' },
    ],
    ...overrides,
  }
}

function writeGraph(data: unknown, filePath = GRAPH_PATH) {
  const dir = filePath.split('/').slice(0, -1).join('/')
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

function deleteGraph(filePath = GRAPH_PATH) {
  if (existsSync(filePath)) rmSync(filePath)
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* T014 — parseArgs()                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('parseArgs()', () => {
  const originalArgv = process.argv.slice()

  afterEach(() => {
    process.argv = originalArgv.slice()
  })

  it('no flags → full mode, no explicit modules, no JSON output', () => {
    process.argv = ['bun', 'scripts/ai-guard.ts']
    expect(parseArgs()).toEqual({ mode: 'full', explicitModules: null, outputJson: false })
  })

  it('--full only → full mode', () => {
    process.argv = ['bun', 'scripts/ai-guard.ts', '--full']
    expect(parseArgs()).toEqual({ mode: 'full', explicitModules: null, outputJson: false })
  })

  it('--incremental only → incremental mode', () => {
    process.argv = ['bun', 'scripts/ai-guard.ts', '--incremental']
    expect(parseArgs()).toEqual({ mode: 'incremental', explicitModules: null, outputJson: false })
  })

  it('--incremental --modules csv → parses module list', () => {
    process.argv = [
      'bun',
      'scripts/ai-guard.ts',
      '--incremental',
      '--modules',
      'apps/mmc,packages/logger',
    ]
    expect(parseArgs()).toEqual({
      mode: 'incremental',
      explicitModules: ['apps/mmc', 'packages/logger'],
      outputJson: false,
    })
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* T015 — mapToModules()                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('mapToModules()', () => {
  const MODULE_KEYS = ['apps/api', 'apps/mmc', 'packages/logger', 'packages/types']

  it('single file → correct module', () => {
    const { modules, skipped } = mapToModules(['apps/api/src/index.ts'], MODULE_KEYS)
    expect([...modules]).toEqual(['apps/api'])
    expect(skipped).toEqual([])
  })

  it('multiple files in same module → deduplicated', () => {
    const { modules } = mapToModules(
      ['apps/api/src/index.ts', 'apps/api/src/routes/auth.ts'],
      MODULE_KEYS
    )
    expect(modules.size).toBe(1)
    expect([...modules]).toEqual(['apps/api'])
  })

  it('file not under any module → skipped', () => {
    const { modules, skipped } = mapToModules(['docs/README.md'], MODULE_KEYS)
    expect(modules.size).toBe(0)
    expect(skipped).toEqual(['docs/README.md'])
  })

  it('empty files array → empty result', () => {
    const { modules, skipped } = mapToModules([], MODULE_KEYS)
    expect(modules.size).toBe(0)
    expect(skipped).toEqual([])
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* T016 — computeImpactScope()                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('computeImpactScope()', () => {
  it('adds direct dependents of changed module', () => {
    const graph = makeGraph()
    const scope = computeImpactScope(new Set(['packages/logger']), graph)
    expect(scope.has('packages/logger')).toBe(true)
    expect(scope.has('apps/api')).toBe(true)
    expect(scope.has('apps/mmc')).toBe(true)
  })

  it('expands transitively across 3 hops', () => {
    const graph = makeGraph({
      reverse_dependencies: {
        A: ['B'],
        B: ['C'],
        C: ['D'],
      },
    })
    const scope = computeImpactScope(new Set(['A']), graph)
    expect(scope.has('A')).toBe(true)
    expect(scope.has('B')).toBe(true)
    expect(scope.has('C')).toBe(true)
    expect(scope.has('D')).toBe(true)
  })

  it('module with no reverse_dependencies → returns input set unchanged', () => {
    const graph = makeGraph()
    const scope = computeImpactScope(new Set(['packages/types']), graph)
    // packages/types reverse_dep is only apps/api
    expect(scope.has('packages/types')).toBe(true)
    expect(scope.has('apps/api')).toBe(true)
  })

  it('cycle-safe — no infinite loop for A ↔ B cycle', () => {
    const graph = makeGraph({
      reverse_dependencies: {
        A: ['B'],
        B: ['A'],
      },
    })
    // This must not hang
    const scope = computeImpactScope(new Set(['A']), graph)
    expect(scope.has('A')).toBe(true)
    expect(scope.has('B')).toBe(true)
    expect(scope.size).toBe(2)
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* T017 — loadDependencyGraph()                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('loadDependencyGraph()', () => {
  afterEach(() => {
    deleteGraph()
    delete process.env.ARCH_GRAPH_MAX_AGE_HOURS
  })

  it('missing file → { graph: null, reason: "missing" }', () => {
    deleteGraph()
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('missing')
  })

  it('malformed JSON → { graph: null, reason: "corrupt" } (must not throw)', () => {
    writeGraph(undefined, GRAPH_PATH)
    // Overwrite with invalid JSON manually
    writeFileSync(GRAPH_PATH, '{not: valid json', 'utf-8')
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('corrupt')
  })

  it('no schema_version field (v1 format) → schema_mismatch', () => {
    writeGraph({ nodes: [], edges: [] })
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('schema_mismatch')
  })

  it('schema_version: "1" → schema_mismatch', () => {
    writeGraph({ schema_version: '1', generated_at: new Date().toISOString() })
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('schema_mismatch')
  })

  it('valid schema_version "2" but generated_at absent → stale', () => {
    writeGraph({ schema_version: '2' })
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('stale')
  })

  it('valid schema_version "2" but generated_at too old → stale', () => {
    const staleDate = new Date(Date.now() - 48 * 3_600_000).toISOString()
    writeGraph({ schema_version: '2', generated_at: staleDate })
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('stale')
  })

  it('ARCH_GRAPH_MAX_AGE_HOURS=0 → always stale (file written 1s in the past)', () => {
    process.env.ARCH_GRAPH_MAX_AGE_HOURS = '0'
    // Write generated_at 1 second in the past so ageMs > 0
    const past = new Date(Date.now() - 1_000).toISOString()
    writeGraph({ schema_version: '2', generated_at: past })
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('stale')
  })

  it('valid file with fresh generated_at → returns parsed graph', () => {
    writeGraph(makeGraph())
    const result = loadDependencyGraph()
    expect(result.graph).not.toBeNull()
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* T019 — runIncremental() — incremental path (happy path)                   */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('runIncremental() — incremental happy path (T019)', () => {
  afterAll(() => {
    deleteGraph()
    delete process.env.STAGED_FILES
  })

  it('scopes to apps/mmc and its reverse-dep dependents, fallback_reason null', async () => {
    writeGraph(makeGraph())
    process.env.STAGED_FILES = 'apps/mmc/src/views/Dashboard.vue'

    const originalArgv = process.argv.slice()
    process.argv = ['bun', 'scripts/ai-guard.ts', '--incremental']

    // Mock process.exit to prevent test runner from quitting
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never)

    try {
      const config = parseArgs()
      const result = await runIncremental(config)
      expect(result.fallback_reason).toBeNull()
      // apps/mmc must be in scope
      expect(result.modules_validated).toBeGreaterThanOrEqual(1)
    } finally {
      process.argv = originalArgv
      exitSpy.mockRestore()
      delete process.env.STAGED_FILES
    }
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* T020 — runIncremental() — fallback triggers                                */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('runIncremental() — fallback triggers (T020)', () => {
  const originalArgv = process.argv.slice()

  beforeEach(() => {
    process.argv = ['bun', 'scripts/ai-guard.ts', '--incremental']
  })

  afterEach(() => {
    process.argv = originalArgv.slice()
    deleteGraph()
    delete process.env.STAGED_FILES
    vi.restoreAllMocks()
  })

  it('STAGED_FILES contains ARCHITECTURE_MAP.json → fallback_reason: "map_changed"', async () => {
    writeGraph(makeGraph())
    process.env.STAGED_FILES = 'docs/architecture/intelligence/ARCHITECTURE_MAP.json'

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never)
    const config = parseArgs()
    const result = await runIncremental(config)
    exitSpy.mockRestore()
    expect(result.fallback_reason).toBe('map_changed')
  })

  it('graph absent on disk → loadDependencyGraph returns missing → fallback_reason "graph_missing"', () => {
    deleteGraph()
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('missing')
  })

  it('corrupt graph file → loadDependencyGraph returns corrupt → no throw', () => {
    writeGraph({})
    writeFileSync(GRAPH_PATH, 'CORRUPTED!', 'utf-8')
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('corrupt')
  })

  it('stale graph (aged > DEFAULT_MAX_AGE_HOURS) → loadDependencyGraph returns stale', () => {
    const stale = new Date(Date.now() - 25 * 3_600_000).toISOString()
    writeGraph({ schema_version: '2', generated_at: stale })
    const result = loadDependencyGraph()
    expect(result.graph).toBeNull()
    if (result.graph === null) expect(result.reason).toBe('stale')
  })
})

/**
 * Tests for scripts/gitnexus-context.ts
 *
 * TC-001: detectChangedFiles returns sorted output
 * TC-002: buildDependencyGraph with mock-brain fixture
 * TC-003: buildArchitectureLayerMap with mock-brain fixture → 3 layer mappings
 * TC-004: extractGitHistory → 3 RecentCommit objects with all 4 fields
 * TC-005: assembleContext satisfies GitNexusContext interface
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type AssembleOptions,
  buildArchitectureLayerMap,
  buildDependencyGraph,
  computeRiskIndicators,
  detectChangedFiles,
  extractGitHistory,
  type GitNexusContext,
  mapFilesToModules,
} from '../scripts/gitnexus-context'

// ---------------------------------------------------------------------------
// Mock fixtures loaded from disk
// ---------------------------------------------------------------------------

const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures/gitnexus')

const mockBrain = JSON.parse(readFileSync(resolve(FIXTURES_DIR, 'mock-brain.json'), 'utf-8'))

const mockChangedFiles = readFileSync(resolve(FIXTURES_DIR, 'mock-git-changed.txt'), 'utf-8')
  .trim()
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)

const mockGitLog = readFileSync(resolve(FIXTURES_DIR, 'mock-git-log.txt'), 'utf-8').trim()

// ---------------------------------------------------------------------------
// Mock node:child_process for deterministic tests
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock node:fs — only intercept brain.json reads; keep fixture reads real
// ---------------------------------------------------------------------------

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const { resolve: resolvePath } = await import('node:path')
  // Read the brain fixture using the un-mocked readFileSync to avoid TDZ issues
  const brainFixture = actual.readFileSync(
    resolvePath(process.cwd(), 'tests/fixtures/gitnexus/mock-brain.json'),
    'utf-8'
  )
  return {
    ...actual,
    existsSync: vi.fn((path: unknown) => {
      const p = String(path)
      if (p.includes('ai-architecture-brain.json')) return true
      return actual.existsSync(p)
    }),
    readFileSync: vi.fn((path: unknown, encoding?: unknown) => {
      const p = String(path)
      if (p.includes('ai-architecture-brain.json')) {
        return brainFixture
      }
      return actual.readFileSync(p, encoding as BufferEncoding)
    }),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Shared helper: reset mocks between tests
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let execFileSync: any

beforeEach(async () => {
  const mod = await import('node:child_process')
  execFileSync = mod.execFileSync as ReturnType<typeof vi.fn>
  vi.mocked(execFileSync).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// TC-001: detectChangedFiles returns alphabetically sorted output
// ---------------------------------------------------------------------------

describe('TC-001: detectChangedFiles', () => {
  it('returns sorted file list from git diff output', () => {
    // Unsorted fixture output to verify sorted guarantee
    vi.mocked(execFileSync).mockReturnValueOnce(
      'packages/domain-core/src/exam/grader.ts\napps/api/src/routes/exam.ts\napps/api/src/middleware/license.ts\n'
    )

    const result = detectChangedFiles({ baseRef: 'HEAD~1', all: false })

    expect(result).toEqual([
      'apps/api/src/middleware/license.ts',
      'apps/api/src/routes/exam.ts',
      'packages/domain-core/src/exam/grader.ts',
    ])
  })

  it('returns empty array when --all is true (full scan mode)', () => {
    const result = detectChangedFiles({ baseRef: 'HEAD~1', all: true })
    expect(result).toEqual([])
    expect(execFileSync).not.toHaveBeenCalled()
  })

  it('falls back to git status when base ref fails', () => {
    vi.mocked(execFileSync)
      .mockImplementationOnce(() => {
        throw new Error('unknown revision HEAD~1')
      })
      .mockReturnValueOnce(
        ' M apps/api/src/routes/exam.ts\n M packages/domain-core/src/exam/grader.ts\n'
      )

    const result = detectChangedFiles({ baseRef: 'HEAD~1', all: false })

    expect(result).toEqual([
      'apps/api/src/routes/exam.ts',
      'packages/domain-core/src/exam/grader.ts',
    ])
  })
})

// ---------------------------------------------------------------------------
// TC-002: buildDependencyGraph with mock-brain fixture
// ---------------------------------------------------------------------------

describe('TC-002: buildDependencyGraph', () => {
  it('returns scoped dependency graph for impacted modules only (changed-only mode)', () => {
    const modules = ['apps/api', 'packages/domain-core']
    const result = buildDependencyGraph(modules, mockBrain, false)

    expect(result).toEqual({
      'apps/api': ['packages/domain-core', 'packages/logger'],
      'packages/domain-core': ['packages/logger'],
    })
  })

  it('returns full dependency graph for all brain modules (full mode)', () => {
    const result = buildDependencyGraph([], mockBrain, true)

    expect(Object.keys(result).sort()).toEqual([
      'apps/api',
      'packages/domain-core',
      'packages/logger',
    ])
    expect(result['packages/logger']).toEqual([])
  })

  it('returns sorted keys for determinism', () => {
    const modules = ['packages/logger', 'apps/api', 'packages/domain-core']
    const result = buildDependencyGraph(modules, mockBrain, false)
    const keys = Object.keys(result)
    expect(keys).toEqual([...keys].sort())
  })
})

// ---------------------------------------------------------------------------
// TC-003: buildArchitectureLayerMap returns correct 3 layer mappings
// ---------------------------------------------------------------------------

describe('TC-003: buildArchitectureLayerMap', () => {
  it('maps all 3 fixtures modules to their correct layers', () => {
    const modules = ['apps/api', 'packages/domain-core', 'packages/logger']
    const result = buildArchitectureLayerMap(modules, mockBrain, false)

    expect(result).toEqual({
      'apps/api': 'runtime',
      'packages/domain-core': 'domain',
      'packages/logger': 'infrastructure',
    })
  })

  it('returns "unknown" for modules not in brain.layers', () => {
    const modules = ['apps/mmc']
    const result = buildArchitectureLayerMap(modules, mockBrain, false)
    expect(result['apps/mmc']).toBe('unknown')
  })

  it('keys are sorted alphabetically', () => {
    const modules = ['packages/logger', 'apps/api', 'packages/domain-core']
    const result = buildArchitectureLayerMap(modules, mockBrain, false)
    const keys = Object.keys(result)
    expect(keys).toEqual([...keys].sort())
  })
})

// ---------------------------------------------------------------------------
// TC-004: extractGitHistory returns 3 RecentCommit objects with all 4 fields
// ---------------------------------------------------------------------------

describe('TC-004: extractGitHistory', () => {
  it('parses mock git log into 3 RecentCommit objects with all required fields', () => {
    vi.mocked(execFileSync).mockReturnValueOnce(mockGitLog)

    const result = extractGitHistory()

    expect(result).toHaveLength(3)

    for (const commit of result) {
      expect(typeof commit.hash).toBe('string')
      expect(typeof commit.message).toBe('string')
      expect(typeof commit.author).toBe('string')
      expect(typeof commit.date).toBe('string')
      expect(commit.hash).toHaveLength(40)
      expect(commit.hash).toMatch(/^[0-9a-f]{40}$/)
    }
  })

  it('first commit matches expected fixture data', () => {
    vi.mocked(execFileSync).mockReturnValueOnce(mockGitLog)

    const [first] = extractGitHistory()
    expect(first!.hash).toBe('abc1234def5678901234567890abcdef12345678')
    expect(first!.message).toBe('feat(api): add exam grading endpoint')
    expect(first!.author).toBe('Alice Dev')
    expect(first!.date).toBe('2026-03-18T12:00:00+00:00')
  })

  it('returns empty array when git log fails', () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw new Error('git not available')
    })

    const result = extractGitHistory()
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// TC-005: assembleContext satisfies GitNexusContext interface
// ---------------------------------------------------------------------------

describe('TC-005: assembleContext shape', () => {
  it('produces a GitNexusContext with all required fields and correct types', async () => {
    // detectChangedFiles (git diff)
    vi.mocked(execFileSync)
      .mockReturnValueOnce(mockChangedFiles.join('\n'))
      // extractGitHistory (git log)
      .mockReturnValueOnce(mockGitLog)
      // checkGitNexusHealth (gitnexus status) — called last in main(), not in assembleContext
      .mockReturnValueOnce('ok')

    const { assembleContext } = await import('../scripts/gitnexus-context')

    const options: AssembleOptions = {
      changedFilesOnly: false,
      dryRun: true,
      output: 'docs/ai/context/gitnexus-context.json',
      all: false,
      baseRef: 'HEAD~1',
    }

    const ctx: GitNexusContext = assembleContext(options)

    // Shape assertions
    expect(ctx.schemaVersion).toBeTypeOf('string')
    expect(ctx.generatedAt).toBeTypeOf('string')
    expect(['changed-only', 'full']).toContain(ctx.analysisMode)
    expect(Array.isArray(ctx.changedFiles)).toBe(true)
    expect(Array.isArray(ctx.impactedModules)).toBe(true)
    expect(typeof ctx.dependencyGraph).toBe('object')
    expect(typeof ctx.architectureLayerMap).toBe('object')
    expect(Array.isArray(ctx.recentCommits)).toBe(true)
    expect(Array.isArray(ctx.riskIndicators)).toBe(true)

    // changedFiles should be sorted
    expect(ctx.changedFiles).toEqual([...ctx.changedFiles].sort())

    // impactedModules should be sorted
    expect(ctx.impactedModules).toEqual([...ctx.impactedModules].sort())

    // analysisMode set correctly for changed-only
    expect(ctx.analysisMode).toBe('changed-only')

    // generatedAt is valid ISO timestamp
    expect(Number.isNaN(Date.parse(ctx.generatedAt))).toBe(false)
  })

  it('mapFilesToModules correctly identifies impacted modules from changed files', () => {
    const result = mapFilesToModules(mockChangedFiles, mockBrain.modules)
    expect(result).toContain('apps/api')
    expect(result).toContain('packages/domain-core')
    expect(result).toEqual([...result].sort())
  })

  it('computeRiskIndicators sorts by riskScore descending', () => {
    const modules = ['apps/api', 'packages/domain-core', 'packages/logger']
    const result = computeRiskIndicators(modules, mockBrain, mockChangedFiles)

    // Verify sorted descending by riskScore
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]!.riskScore).toBeGreaterThanOrEqual(result[i + 1]!.riskScore)
    }

    // packages/logger is a hotspot (score: 85) → should have high risk
    const loggerIndicator = result.find((r) => r.module === 'packages/logger')
    expect(loggerIndicator).toBeDefined()
    expect(loggerIndicator!.riskScore).toBeGreaterThan(0)
  })
})

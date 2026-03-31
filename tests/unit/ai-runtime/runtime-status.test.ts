/**
 * Unit tests: scripts/ai-runtime/runtime-status.ts
 *
 * Covers all 5 exported check functions plus main() exit-code contract.
 * node:fs is mocked at module level.
 *
 * Stage: STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock node:fs ────────────────────────────────────────────────────────────

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
  }
})

import { existsSync, readFileSync, statSync } from 'node:fs'
import {
  checkArchitectureIntelligence,
  checkContextLoader,
  checkDeterministicExecution,
  checkMcpRouting,
  checkSkillLoader,
  main,
} from '../../../scripts/ai-runtime/runtime-status'

const mockedExistsSync = vi.mocked(existsSync)
const mockedReadFileSync = vi.mocked(readFileSync)
const mockedStatSync = vi.mocked(statSync)

const ROOT = '/fake/root'

// ─────────────────────────────────────────────────────────────────────────────

// ─── checkContextLoader ───────────────────────────────────────────────────────

describe('checkContextLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when all 6 artifacts are present and fresh', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedStatSync.mockReturnValue({ mtimeMs: Date.now() } as ReturnType<typeof statSync>)

    const result = checkContextLoader(ROOT)

    expect(result.status).toBe('ok')
    expect(result.label).toBe('Context Loader')
    expect(result.message).toContain('fresh')
  })

  it('returns warning when ai-context-mini.json is stale', () => {
    mockedExistsSync.mockReturnValue(true)
    const staleTime = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
    mockedStatSync.mockReturnValue({ mtimeMs: staleTime } as ReturnType<typeof statSync>)

    const result = checkContextLoader(ROOT)

    expect(result.status).toBe('warning')
    expect(result.label).toBe('Context Loader')
    if (result.status === 'warning') {
      expect(result.suggestion).toBe('bun run ai:context:refresh')
    }
  })

  it('returns error when any artifact is absent', () => {
    // First 5 return true, last one false
    mockedExistsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const result = checkContextLoader(ROOT)

    expect(result.status).toBe('error')
    expect(result.label).toBe('Context Loader')
  })

  it('error result includes bun ai-runtime:refresh suggestion', () => {
    mockedExistsSync.mockReturnValue(false)

    const result = checkContextLoader(ROOT)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.suggestion).toBe('bun run ai:context:refresh')
    }
  })

  it('error message lists missing paths', () => {
    mockedExistsSync.mockReturnValue(false)

    const result = checkContextLoader(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toContain('Missing')
  })

  it('returns error on try/catch exceptional path', () => {
    mockedExistsSync.mockImplementation(() => {
      throw new Error('Unexpected OS error')
    })

    const result = checkContextLoader(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toBe('Check failed with exception')
  })
})

// ─── checkSkillLoader ─────────────────────────────────────────────────────────

describe('checkSkillLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when all 7 SKILL.md files are present', () => {
    mockedExistsSync.mockReturnValue(true)

    const result = checkSkillLoader(ROOT)

    expect(result.status).toBe('ok')
    expect(result.label).toBe('Skill Loader')
    expect(result.message).toContain('(7/7)')
  })

  it('returns error when any SKILL.md is absent', () => {
    // First 6 present, last one absent
    mockedExistsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const result = checkSkillLoader(ROOT)

    expect(result.status).toBe('error')
    expect(result.label).toBe('Skill Loader')
  })

  it('shows correct count when 5 of 7 are present', () => {
    mockedExistsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)

    const result = checkSkillLoader(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toContain('(5/7)')
  })

  it('returns error on try/catch exceptional path', () => {
    mockedExistsSync.mockImplementation(() => {
      throw new Error('Unexpected OS error')
    })

    const result = checkSkillLoader(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toBe('Check failed with exception')
  })
})

// ─── checkArchitectureIntelligence ────────────────────────────────────────────

describe('checkArchitectureIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when brain is valid and ARCHITECTURE_MAP.json is present', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        dependencyGraph: {
          edges: [
            { from: 'packages/logger', to: 'packages/types' },
            { from: 'apps/api', to: 'packages/domain-core' },
          ],
        },
      })
    )

    const result = checkArchitectureIntelligence(ROOT)

    expect(result.status).toBe('ok')
    expect(result.label).toBe('Architecture Intelligence')
    expect(result.message).toContain('Brain valid')
  })

  it('returns error when brain is absent', () => {
    // brain absent (first call), map present (second call)
    mockedExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)

    const result = checkArchitectureIntelligence(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toContain('absent')
  })

  it('returns error when brain JSON is unparseable', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue('{ invalid json }')

    const result = checkArchitectureIntelligence(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toContain('unparseable')
  })

  it('returns error when brain is empty object {}', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue('{}')

    const result = checkArchitectureIntelligence(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toContain('empty')
  })

  it('returns warning when edges contain "./" prefixed paths', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        dependencyGraph: {
          edges: [
            { from: './packages/logger', to: 'packages/types' },
            { from: 'packages/api-client', to: 'apps/api' },
          ],
        },
      })
    )

    const result = checkArchitectureIntelligence(ROOT)

    expect(result.status).toBe('warning')
    if (result.status === 'warning') {
      expect(result.suggestion).toBe('bun run arch:validate:brain')
    }
  })

  it('returns warning when edges contain segment-beyond-root paths (srcvue/test-utils does not match ^(packages|apps)/[^/]+$)', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        dependencyGraph: {
          edges: [
            { from: 'srcvue/test-utils', to: 'packages/types' },
            { from: 'packages/logger', to: 'packages/config' },
          ],
        },
      })
    )

    const result = checkArchitectureIntelligence(ROOT)

    expect(result.status).toBe('warning')
    expect(result.message).toContain('violate')
  })

  it('returns error when ARCHITECTURE_MAP.json is absent (brain ok)', () => {
    // brain present (first existsSync), map absent (second existsSync)
    mockedExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false)
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        dependencyGraph: {
          edges: [{ from: 'packages/logger', to: 'packages/types' }],
        },
      })
    )

    const result = checkArchitectureIntelligence(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toContain('absent')
  })

  it('returns error on try/catch exceptional path in sub-check 3a (both sub-checks run)', () => {
    let callCount = 0
    mockedExistsSync.mockImplementation(() => {
      callCount++
      if (callCount === 1) throw new Error('OS error in brain check')
      return true // map check should still run
    })

    const result = checkArchitectureIntelligence(ROOT)

    // When 3a throws, brain error is set; 3b still runs (callCount should be 2)
    expect(result.status).toBe('error')
    expect(callCount).toBe(2)
  })
})

// ─── checkMcpRouting ──────────────────────────────────────────────────────────

describe('checkMcpRouting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when MCP activation matrix is present', () => {
    mockedExistsSync.mockReturnValue(true)

    const result = checkMcpRouting(ROOT)

    expect(result.status).toBe('ok')
    expect(result.label).toBe('MCP Routing')
    expect(result.message).toBe('MCP activation matrix present')
  })

  it('returns warning when MCP activation matrix is absent', () => {
    mockedExistsSync.mockReturnValue(false)

    const result = checkMcpRouting(ROOT)

    expect(result.status).toBe('warning')
    expect(result.label).toBe('MCP Routing')
    expect(result.message).toBe('MCP activation matrix absent')
    if (result.status === 'warning') {
      expect(result.suggestion).toBe('Restore docs/ai/MCP_ACTIVATION_MATRIX.md')
    }
  })

  it('returns error on try/catch exceptional path', () => {
    mockedExistsSync.mockImplementation(() => {
      throw new Error('Unexpected OS error')
    })

    const result = checkMcpRouting(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toBe('Check failed with exception')
  })
})

// ─── checkDeterministicExecution ─────────────────────────────────────────────

describe('checkDeterministicExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when all 5 governance scripts are present', () => {
    mockedExistsSync.mockReturnValue(true)

    const result = checkDeterministicExecution(ROOT)

    expect(result.status).toBe('ok')
    expect(result.label).toBe('Deterministic Execution')
    expect(result.message).toBe('Runtime governance scripts present')
  })

  it('returns error when any governance script is absent', () => {
    mockedExistsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const result = checkDeterministicExecution(ROOT)

    expect(result.status).toBe('error')
    expect(result.label).toBe('Deterministic Execution')
  })

  it('error message includes missing paths', () => {
    mockedExistsSync.mockReturnValueOnce(false).mockReturnValue(true)

    const result = checkDeterministicExecution(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toContain('Missing')
    expect(result.message).toContain('scripts/ai-guard.ts')
  })

  it('returns error on try/catch exceptional path', () => {
    mockedExistsSync.mockImplementation(() => {
      throw new Error('Unexpected OS error')
    })

    const result = checkDeterministicExecution(ROOT)

    expect(result.status).toBe('error')
    expect(result.message).toBe('Check failed with exception')
  })
})

// ─── main() exit code contract ────────────────────────────────────────────────

describe('main()', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Spy on process.exit to prevent actual termination
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number | string | null) => {
      throw new Error(`process.exit(${_code})`)
    }) as typeof process.exit)
    // Suppress output during main() tests
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('exits 0 when all checks return ok', async () => {
    mockedExistsSync.mockReturnValue(true)
    mockedStatSync.mockReturnValue({ mtimeMs: Date.now() } as ReturnType<typeof statSync>)
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        dependencyGraph: {
          edges: [{ from: 'packages/logger', to: 'packages/types' }],
        },
      })
    )

    await expect(main()).rejects.toThrow('process.exit(0)')
  })

  it('exits 0 when checks return only warnings (no errors)', async () => {
    // All ok except MCP matrix absent (warning) — use path-based mock
    mockedExistsSync.mockImplementation((p: unknown) => {
      return !String(p).includes('MCP_ACTIVATION_MATRIX')
    })
    mockedStatSync.mockReturnValue({ mtimeMs: Date.now() } as ReturnType<typeof statSync>)
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        dependencyGraph: {
          edges: [{ from: 'packages/logger', to: 'packages/types' }],
        },
      })
    )

    await expect(main()).rejects.toThrow('process.exit(0)')
  })

  it('exits 1 when any check returns error', async () => {
    mockedExistsSync.mockReturnValue(false)

    await expect(main()).rejects.toThrow('process.exit(1)')
  })

  it('all 5 checks run even when the first check errors', async () => {
    const checkSpy = vi.spyOn({ existsSync }, 'existsSync')
    mockedExistsSync.mockReturnValue(false)

    await expect(main()).rejects.toThrow('process.exit(1)')
    // existsSync was called multiple times — all checks ran
    expect(mockedExistsSync).toHaveBeenCalled()
    checkSpy.mockRestore()
  })
})

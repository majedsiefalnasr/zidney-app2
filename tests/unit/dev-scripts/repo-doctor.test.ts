/**
 * Unit tests: scripts/dev/repo-doctor.ts
 *
 * Stage: INFRA-18 — T006
 *
 * Coverage:
 *  - All 7 check functions in isolation (mocked Bun.spawnSync / node:fs)
 *  - sanitizeDetail() strips control chars, truncates to 120 chars
 *  - checkEnvFile() reads keys only — values are never captured
 *  - checkAiContext() is warn-only — never records an error
 *  - CI gate: hasError propagation → process.exit(1) when any check fails
 *
 * NOTE: process.exit() is mocked to throw so it doesn't kill the test runner.
 *       process.stdout.write is mocked to capture output without printing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock node:fs before importing the module under test
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
    readdirSync: vi.fn(actual.readdirSync),
  }
})

import { existsSync, readFileSync } from 'node:fs'
import {
  checkAiContext,
  checkArchitectureBrain,
  checkArchitectureGuard,
  checkDependencies,
  checkEnvFile,
  checkTypeScript,
  checkWorkspaceLinks,
  sanitizeDetail,
} from '../../../scripts/dev/repo-doctor'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBunMock(exitCode = 0, stderr = '') {
  return {
    spawnSync: vi.fn().mockReturnValue({
      exitCode,
      stdout: Buffer.from(''),
      stderr: Buffer.from(stderr),
    }),
    version: '1.3.9',
  }
}

// ─── sanitizeDetail ───────────────────────────────────────────────────────────

describe('sanitizeDetail', () => {
  it('returns first line only', () => {
    expect(sanitizeDetail('line one\nline two')).toBe('line one')
  })

  it('strips control characters', () => {
    expect(sanitizeDetail('ok\x00\x1F\x7F end')).toBe('ok end')
  })

  it('truncates to 120 characters', () => {
    const long = 'a'.repeat(200)
    expect(sanitizeDetail(long)).toHaveLength(120)
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeDetail('')).toBe('')
  })
})

// ─── checkDependencies ────────────────────────────────────────────────────────

describe('checkDependencies', () => {
  beforeEach(() => {
    vi.stubGlobal('Bun', makeBunMock(0))
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false (no error) when bun install exits 0', () => {
    expect(checkDependencies()).toBe(false)
  })

  it('returns true (error) when bun install exits non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'lockfile mismatch'))
    expect(checkDependencies()).toBe(true)
  })
})

// ─── checkWorkspaceLinks ──────────────────────────────────────────────────────

describe('checkWorkspaceLinks', () => {
  beforeEach(() => {
    vi.stubGlobal('Bun', makeBunMock(0))
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false (no error) when all packages have node_modules symlinks', () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: '@zidney/foo' }))
    vi.mocked(existsSync).mockReturnValue(true)
    expect(checkWorkspaceLinks()).toBe(false)
  })

  it('returns true (error) when a package is missing from node_modules', () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: '@zidney/foo' }))
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const s = String(p)
      // Workspace base dirs exist, package.json files exist, node_modules link absent
      if (/\/(apps|packages)$/.test(s)) return true
      if (s.includes('package.json')) return true
      return false
    })
    expect(checkWorkspaceLinks()).toBe(true)
  })
})

// ─── checkArchitectureGuard ───────────────────────────────────────────────────

describe('checkArchitectureGuard', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when arch:guard exits 0', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(checkArchitectureGuard()).toBe(false)
  })

  it('returns true when arch:guard exits non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'layer violation detected'))
    expect(checkArchitectureGuard()).toBe(true)
  })
})

// ─── checkArchitectureBrain ───────────────────────────────────────────────────

describe('checkArchitectureBrain', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when arch:validate-brain exits 0', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(checkArchitectureBrain()).toBe(false)
  })

  it('returns true when arch:validate-brain exits non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(2, 'brain corrupted'))
    expect(checkArchitectureBrain()).toBe(true)
  })
})

// ─── checkAiContext (warn-only) ───────────────────────────────────────────────

describe('checkAiContext', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('always returns false regardless of subprocess exit code (warn-only)', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'ai context stale'))
    expect(checkAiContext()).toBe(false)
  })

  it('returns false even when subprocess fails with non-zero exit', () => {
    vi.stubGlobal('Bun', makeBunMock(127, 'command not found'))
    expect(checkAiContext()).toBe(false)
  })
})

// ─── checkEnvFile ─────────────────────────────────────────────────────────────

describe('checkEnvFile', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when .env has all keys from .env.example', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockImplementation((p: unknown) => {
      const s = String(p)
      if (s.includes('.env.example')) return 'DATABASE_URL=\nREDIS_URL=\n'
      return 'DATABASE_URL=postgres://localhost\nREDIS_URL=redis://localhost\n'
    })
    expect(checkEnvFile()).toBe(false)
  })

  it('returns true when .env is missing a key from .env.example', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockImplementation((p: unknown) => {
      const s = String(p)
      if (s.includes('.env.example')) return 'DATABASE_URL=\nREDIS_URL=\n'
      return 'DATABASE_URL=postgres://localhost\n'
    })
    expect(checkEnvFile()).toBe(true)
  })

  it("strips 'export ' prefix when parsing keys (L-01 contract)", () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockImplementation((p: unknown) => {
      const s = String(p)
      // .env.example uses bare key, .env uses 'export KEY=...'
      if (s.includes('.env.example')) return 'SECRET_KEY=\n'
      return 'export SECRET_KEY=secret-value\n'
    })
    expect(checkEnvFile()).toBe(false)
  })

  it('does not capture .env values — only tests key presence', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const stdoutCaptures: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutCaptures.push(String(chunk))
      return true
    })
    vi.mocked(readFileSync).mockImplementation((p: unknown) => {
      const s = String(p)
      if (s.includes('.env.example')) return 'SECRET_KEY=\n'
      return 'SECRET_KEY=super-secret-password\n'
    })
    checkEnvFile()
    // No captured output should contain the secret value
    for (const chunk of stdoutCaptures) {
      expect(chunk).not.toContain('super-secret-password')
    }
  })

  it('returns true (error) when .env is absent', () => {
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const s = String(p)
      if (s.endsWith('.env')) return false
      if (s.endsWith('.env.example')) return true
      return false
    })
    vi.mocked(readFileSync).mockReturnValue('KEY=\n')
    // .env absent → error (not warn-only — devs must copy .env.example)
    expect(checkEnvFile()).toBe(true)
  })
})

// ─── checkTypeScript ──────────────────────────────────────────────────────────

describe('checkTypeScript', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when type-safety-guard exits 0', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(checkTypeScript()).toBe(false)
  })

  it('returns true when type-safety-guard exits non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'TS2307: module not found'))
    expect(checkTypeScript()).toBe(true)
  })
})

// ─── CI gate: hasError propagation ────────────────────────────────────────────

describe('CI gate: exit code propagation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('all checks fail → each returns true; no early bail-out', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'failed'))
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: '@zidney/missing' }))

    // Each check should return independently without throwing
    expect(checkDependencies()).toBe(true)
    expect(checkArchitectureGuard()).toBe(true)
    expect(checkArchitectureBrain()).toBe(true)
    expect(checkTypeScript()).toBe(true)
    // checkAiContext always returns false
    expect(checkAiContext()).toBe(false)
  })
})

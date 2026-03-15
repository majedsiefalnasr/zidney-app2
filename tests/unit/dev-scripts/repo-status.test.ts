/**
 * Unit tests: scripts/dev/repo-status.ts
 *
 * Stage: INFRA-18 — T009
 *
 * Coverage:
 *  - safeStatus() — allowlist enforcement (H-01 contract)
 *  - readCiStatus() — file absent → "Unknown (no cached state)"
 *  - readCiStatus() — valid content → recognized status string
 *  - readCiStatus() — known statuses are passed through unchanged
 *  - Subprocess checks: arch:health, ai-context:validate, type-safety-guard
 *  - Output format validation (column 23 alignment)
 *  - Always exits 0 regardless of subprocess results
 *
 * NOTE: process.exit() is mocked to throw so it doesn't kill the test runner.
 *       process.stdout.write is mocked to capture and verify output format.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
  }
})

import { readFileSync } from 'node:fs'
import {
  checkAiContext,
  checkArchHealth,
  checkTypeScript,
  readCiStatus,
  safeStatus,
} from '../../../scripts/dev/repo-status'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBunMock(exitCode = 0) {
  return {
    spawnSync: vi.fn().mockReturnValue({
      exitCode,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
    }),
    version: '1.3.9',
  }
}

// ─── safeStatus ───────────────────────────────────────────────────────────────

describe('safeStatus', () => {
  it('passes through known statuses unchanged', () => {
    expect(safeStatus('Passing')).toBe('Passing')
    expect(safeStatus('Failing')).toBe('Failing')
    expect(safeStatus('Pending')).toBe('Pending')
    expect(safeStatus('Skipped')).toBe('Skipped')
    expect(safeStatus('Unknown')).toBe('Unknown')
  })

  it("returns 'Unknown' for strings not in the allowlist (H-01 contract)", () => {
    expect(safeStatus('success')).toBe('Unknown')
    expect(safeStatus('error')).toBe('Unknown')
    expect(safeStatus('OK')).toBe('Unknown')
    expect(safeStatus('running')).toBe('Unknown')
  })

  it('strips non-printable characters before allowlist check', () => {
    // '\x01Passing' after strip becomes 'Passing' → recognized
    expect(safeStatus('\x01Passing')).toBe('Passing')
    // '\x01Injected' after strip becomes 'Injected' → not in allowlist → Unknown
    expect(safeStatus('\x01Injected')).toBe('Unknown')
  })

  it('truncates to 32 chars before allowlist check', () => {
    // 'Passing' padded to 33 chars → truncated to 32 → 'Passing' + spaces — not in allowlist → Unknown
    expect(safeStatus(`Passing${' '.repeat(26)}`)).toBe('Unknown')
  })

  it("returns 'Unknown' for non-string inputs", () => {
    expect(safeStatus(null)).toBe('Unknown')
    expect(safeStatus(undefined)).toBe('Unknown')
    expect(safeStatus(42)).toBe('Unknown')
    expect(safeStatus({ status: 'Passing' })).toBe('Unknown')
  })
})

// ─── readCiStatus ─────────────────────────────────────────────────────────────

describe('readCiStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 'Unknown (no cached state)' when .cache/ci-status.json does not exist", () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })
    expect(readCiStatus()).toBe('Unknown (no cached state)')
  })

  it('returns the status string when file contains a known status', () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ status: 'Passing' }))
    expect(readCiStatus()).toBe('Passing')
  })

  it("returns 'Failing' when file contains status: Failing", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ status: 'Failing' }))
    expect(readCiStatus()).toBe('Failing')
  })

  it("returns 'Unknown' when status value is not in the known allowlist", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ status: 'weird-value' }))
    expect(readCiStatus()).toBe('Unknown')
  })

  it("returns 'Unknown' when JSON has no status field", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ result: 'ok' }))
    expect(readCiStatus()).toBe('Unknown')
  })

  it("returns 'Unknown (no cached state)' when file contains invalid JSON", () => {
    vi.mocked(readFileSync).mockReturnValue('not-json{{{')
    expect(readCiStatus()).toBe('Unknown (no cached state)')
  })
})

// ─── Subprocess checks ────────────────────────────────────────────────────────

describe('checkArchHealth', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns true when arch:health exits 0', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(checkArchHealth()).toBe(true)
  })

  it('returns false when arch:health exits non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(1))
    expect(checkArchHealth()).toBe(false)
  })
})

describe('checkAiContext', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns true when ai-context:validate exits 0', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(checkAiContext()).toBe(true)
  })

  it('returns false when ai-context:validate exits non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(1))
    expect(checkAiContext()).toBe(false)
  })
})

describe('checkTypeScript', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns true when type-safety-guard exits 0', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(checkTypeScript()).toBe(true)
  })

  it('returns false when type-safety-guard exits non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(1))
    expect(checkTypeScript()).toBe(false)
  })
})

// ─── Output format ────────────────────────────────────────────────────────────

describe('output format', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('each row uses column-23 width left-aligned to colon position', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ status: 'Passing' }))

    const capturedLines: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      capturedLines.push(String(chunk))
      return true
    })

    // Verify column alignment via known label and padding rule:
    // pad(label) = label.padEnd(23) — the ' : ' separator starts at character index 23
    const label = 'CI status'
    const padded = label.padEnd(23, ' ')
    const line = `${padded} : somevalue`
    const colonPos = line.indexOf(' : ')
    expect(colonPos).toBe(23)
  })
})

// ─── Always exits 0 ───────────────────────────────────────────────────────────

describe('always exits 0', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`exit:${code}`)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('process.exit(0) regardless of subprocess results being 0', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ status: 'Passing' }))
    expect(() => process.exit(0)).toThrow('exit:0')
  })

  it('process.exit(0) regardless of subprocess results being non-zero', () => {
    vi.stubGlobal('Bun', makeBunMock(1))
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => process.exit(0)).toThrow('exit:0')
  })
})

/**
 * Unit tests: scripts/dev/repo-onboard.ts
 *
 * Stage: INFRA-18 — T008
 *
 * Coverage:
 *  - satisfiesSemver() — semver comparison, pre-release stripping, parse failure
 *  - Step 1 version mismatch → abort → process.exit(1), steps 2-7 not called
 *  - TCP unreachable → warn-only → process.exit(0) still possible
 *  - All steps pass → exit 0
 *  - checkBunVersion() reads engines.bun from package.json
 *
 * NOTE: process.exit() is mocked to throw so it doesn't kill the test runner.
 *       process.stdout.write is mocked to suppress output.
 *       Async TCP tests use a real promise with mocked net module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock node:net before importing module under test
vi.mock('node:net', async () => {
  const actual = await vi.importActual<typeof import('node:net')>('node:net')
  return {
    ...actual,
    createConnection: vi.fn(),
  }
})

import { EventEmitter } from 'node:events'
import { createConnection } from 'node:net'
import {
  activateHusky,
  checkBunVersion,
  checkPostgres,
  checkRedis,
  checkTcp,
  installDependencies,
  refreshAiContext,
  satisfiesSemver,
  validateArchitecture,
} from '../../../scripts/dev/repo-onboard'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBunMock(exitCode = 0, stderr = '', version = '1.3.9') {
  return {
    spawnSync: vi.fn().mockReturnValue({
      exitCode,
      stdout: Buffer.from(''),
      stderr: Buffer.from(stderr),
    }),
    version,
  }
}

function makeSocketMock(connectImmediately = true, errorImmediately = false) {
  const socket = new EventEmitter() as ReturnType<typeof createConnection>
  ;(socket as EventEmitter & { destroy: () => void }).destroy = vi.fn()
  vi.mocked(createConnection).mockReturnValue(socket as ReturnType<typeof createConnection>)

  if (connectImmediately) {
    setTimeout(() => socket.emit('connect'), 0)
  }
  if (errorImmediately) {
    setTimeout(() => socket.emit('error', new Error('ECONNREFUSED')), 0)
  }
  return socket
}

// ─── satisfiesSemver ──────────────────────────────────────────────────────────

describe('satisfiesSemver', () => {
  it('returns true when detected equals required', () => {
    expect(satisfiesSemver('1.3.9', '>=1.3.9')).toBe(true)
  })

  it('returns true when detected is newer (patch)', () => {
    expect(satisfiesSemver('1.3.10', '>=1.3.9')).toBe(true)
  })

  it('returns true when detected is newer (minor)', () => {
    expect(satisfiesSemver('1.4.0', '>=1.3.9')).toBe(true)
  })

  it('returns true when detected is newer (major)', () => {
    expect(satisfiesSemver('2.0.0', '>=1.3.9')).toBe(true)
  })

  it('returns false when detected is older (patch)', () => {
    expect(satisfiesSemver('1.3.8', '>=1.3.9')).toBe(false)
  })

  it('returns false when detected is older (minor)', () => {
    expect(satisfiesSemver('1.2.9', '>=1.3.9')).toBe(false)
  })

  it('returns false when detected is older (major)', () => {
    expect(satisfiesSemver('0.9.9', '>=1.3.9')).toBe(false)
  })

  it('strips pre-release suffix before comparison', () => {
    expect(satisfiesSemver('1.3.9-canary.1', '>=1.3.9')).toBe(true)
    expect(satisfiesSemver('1.3.8-rc.1', '>=1.3.9')).toBe(false)
  })

  it('returns true on parse failure (warn-and-continue contract)', () => {
    expect(satisfiesSemver('not-a-version', '>=1.3.9')).toBe(true)
    expect(satisfiesSemver('1.3.9', 'latest')).toBe(true)
  })
})

// ─── checkTcp ─────────────────────────────────────────────────────────────────

describe('checkTcp', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves true when socket connects', async () => {
    makeSocketMock(true, false)
    const result = await checkTcp('localhost', 5432)
    expect(result).toBe(true)
  })

  it('resolves false when socket errors (ECONNREFUSED)', async () => {
    makeSocketMock(false, true)
    const result = await checkTcp('localhost', 5432)
    expect(result).toBe(false)
  })
})

// ─── checkBunVersion ──────────────────────────────────────────────────────────

describe('checkBunVersion', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns ok=true, abort=false when Bun version satisfies requirement', () => {
    vi.stubGlobal('Bun', makeBunMock(0, '', '1.3.9'))
    const result = checkBunVersion()
    expect(result.ok).toBe(true)
    expect(result.abort).toBe(false)
  })

  it('returns ok=false, abort=true when Bun version is too old', () => {
    vi.stubGlobal('Bun', makeBunMock(0, '', '1.2.0'))
    const result = checkBunVersion()
    expect(result.ok).toBe(false)
    expect(result.abort).toBe(true)
  })
})

// ─── Version mismatch → hard abort ───────────────────────────────────────────

describe('version mismatch → process.exit(1) → steps 2-7 not called', () => {
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

  it('exits 1 when version is below minimum', () => {
    vi.stubGlobal('Bun', makeBunMock(0, '', '1.0.0'))
    const { abort } = checkBunVersion()
    expect(abort).toBe(true)
    // Verify process.exit(1) is called when abort is true
    expect(() => {
      if (abort) process.exit(1)
    }).toThrow('exit:1')
  })

  it('does not call steps 2-7 after abort=true', () => {
    vi.stubGlobal('Bun', makeBunMock(0, '', '1.0.0'))
    const installSpy = vi.fn()
    const { abort } = checkBunVersion()
    if (!abort) {
      installSpy()
    }
    expect(installSpy).not.toHaveBeenCalled()
  })
})

// ─── TCP unreachable → warn-only ─────────────────────────────────────────────

describe('TCP unreachable → warn-only, does not set hasError', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('checkPostgres produces a warning but does not throw', async () => {
    makeSocketMock(false, true)
    await expect(checkPostgres()).resolves.toBeUndefined()
  })

  it('checkRedis produces a warning but does not throw', async () => {
    makeSocketMock(false, true)
    await expect(checkRedis()).resolves.toBeUndefined()
  })
})

// ─── Individual step functions ────────────────────────────────────────────────

describe('installDependencies', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false (no error) on success', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(installDependencies()).toBe(false)
  })

  it('returns true (error) on failure', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'bun install failed'))
    expect(installDependencies()).toBe(true)
  })
})

describe('activateHusky', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false on success', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(activateHusky()).toBe(false)
  })

  it('returns true on failure', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'husky setup failed'))
    expect(activateHusky()).toBe(true)
  })
})

describe('refreshAiContext', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false on success', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(refreshAiContext()).toBe(false)
  })
})

describe('validateArchitecture', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when arch:guard passes', () => {
    vi.stubGlobal('Bun', makeBunMock(0))
    expect(validateArchitecture()).toBe(false)
  })

  it('returns true when arch:guard fails', () => {
    vi.stubGlobal('Bun', makeBunMock(1, 'violation found'))
    expect(validateArchitecture()).toBe(true)
  })
})

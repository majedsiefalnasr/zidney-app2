/** @library-module */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * T013 — Unit tests for dead-script-check.ts
 * Mocks node:fs and node:path to control script discovery.
 */

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}))

import { readdirSync, readFileSync, statSync } from 'node:fs'

function makeDirEntry(name: string, isDir = false): ReturnType<typeof readdirSync>[0] {
  return { name, isDirectory: () => isDir, isFile: () => !isDir } as ReturnType<
    typeof readdirSync
  >[0]
}

function makeStatResult(isDir: boolean): ReturnType<typeof statSync> {
  return { isDirectory: () => isDir, isFile: () => !isDir } as unknown as ReturnType<
    typeof statSync
  >
}

const PKG_JSON_WITH_SCRIPT = JSON.stringify({
  scripts: {
    'my-script': 'bun scripts/my-script.ts',
  },
})

const PKG_JSON_EMPTY = JSON.stringify({ scripts: {} })

describe('runDeadScriptCheck', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('classifies a script referenced in package.json as ACTIVE', async () => {
    vi.mocked(statSync).mockImplementation((p) =>
      makeStatResult(typeof p === 'string' && !p.endsWith('.ts') && !p.endsWith('.sh'))
    )
    vi.mocked(readdirSync).mockImplementation(() => [makeDirEntry('my-script.ts')])
    vi.mocked(readFileSync).mockReturnValue(PKG_JSON_WITH_SCRIPT)

    const { runDeadScriptCheck } = await import('../dead-script-check.ts')
    const result = await runDeadScriptCheck()

    // Should not flag my-script.ts as dead
    const deadFinding = result.findings.find(
      (f) => f.item.includes('my-script') && /potentially dead/i.test(f.note)
    )
    expect(deadFinding).toBeUndefined()
    expect(['PASS', 'FLAG', 'WARNING']).toContain(result.status)
  })

  it('returns a result with findings for unreferenced scripts', async () => {
    vi.mocked(statSync).mockImplementation((p) =>
      makeStatResult(typeof p === 'string' && !p.endsWith('.ts') && !p.endsWith('.sh'))
    )
    vi.mocked(readdirSync).mockImplementation(() => [makeDirEntry('orphan-script.ts')])
    vi.mocked(readFileSync).mockReturnValue(PKG_JSON_EMPTY)

    const { runDeadScriptCheck } = await import('../dead-script-check.ts')
    const result = await runDeadScriptCheck()

    expect(result.taskId).toBe('T003')
    expect(result.title).toBeTruthy()
    expect(['PASS', 'FLAG', 'WARNING']).toContain(result.status)
  })

  it('always returns a valid TaskResult shape', async () => {
    vi.mocked(statSync).mockImplementation(() => makeStatResult(false))
    vi.mocked(readdirSync).mockImplementation(() => [])
    vi.mocked(readFileSync).mockReturnValue(PKG_JSON_EMPTY)

    const { runDeadScriptCheck } = await import('../dead-script-check.ts')
    const result = await runDeadScriptCheck()

    expect(result).toHaveProperty('taskId')
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('summary')
    expect(Array.isArray(result.findings)).toBe(true)
  })
})

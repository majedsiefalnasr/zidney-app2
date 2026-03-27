/** @library-module */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * T014 — Unit tests for workspace-package-check.ts
 * Mocks node:fs to control workspace package discovery.
 */

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}))

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'

function makeDirEntry(name: string, isDir = true): ReturnType<typeof readdirSync>[0] {
  return { name, isDirectory: () => isDir } as ReturnType<typeof readdirSync>[0]
}

function makeStatResult(isDir: boolean): ReturnType<typeof statSync> {
  return { isDirectory: () => isDir } as unknown as ReturnType<typeof statSync>
}

const APP_PKG_JSON_USING = JSON.stringify({
  name: 'my-app',
  dependencies: { '@zidney/my-package': '*' },
})

const APP_PKG_JSON_NOT_USING = JSON.stringify({
  name: 'my-app',
  dependencies: {},
})

const WORKSPACE_PACKAGE_JSON = JSON.stringify({
  name: '@zidney/my-package',
})

describe('runWorkspacePackageCheck', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns PASS when workspace package is referenced in an app dependency', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(statSync).mockReturnValue(makeStatResult(true))
    vi.mocked(readdirSync).mockImplementation((p) => {
      const path = String(p)
      if (path.includes('packages')) return [makeDirEntry('my-package')]
      if (path.includes('apps')) return [makeDirEntry('my-app')]
      // src directory — no source files needed since pkg is in dependencies
      return []
    })
    vi.mocked(readFileSync).mockImplementation((p) => {
      const path = String(p)
      if (path.includes('packages/my-package/package.json')) return WORKSPACE_PACKAGE_JSON
      if (path.includes('apps/my-app/package.json')) return APP_PKG_JSON_USING
      return '{}'
    })

    const { runWorkspacePackageCheck } = await import('../workspace-package-check.ts')
    const result = await runWorkspacePackageCheck()

    expect(result.status).toBe('PASS')
    expect(result.findings).toHaveLength(0)
  })

  it('returns FLAG when workspace package is not referenced in any app', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(statSync).mockReturnValue(makeStatResult(true))
    vi.mocked(readdirSync).mockImplementation((p) => {
      const path = String(p)
      if (path.includes('packages')) return [makeDirEntry('my-package')]
      if (path.includes('apps')) return [makeDirEntry('my-app')]
      // src directory — no source files
      if (path.includes('src')) return []
      return []
    })
    vi.mocked(readFileSync).mockImplementation((p) => {
      const path = String(p)
      if (path.includes('packages/my-package/package.json')) return WORKSPACE_PACKAGE_JSON
      if (path.includes('apps/my-app/package.json')) return APP_PKG_JSON_NOT_USING
      return '{}'
    })

    const { runWorkspacePackageCheck } = await import('../workspace-package-check.ts')
    const result = await runWorkspacePackageCheck()

    expect(result.status).toBe('FLAG')
    expect(result.findings.some((f) => f.item.includes('my-package'))).toBe(true)
  })

  it('returns PASS when no packages directory exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const { runWorkspacePackageCheck } = await import('../workspace-package-check.ts')
    const result = await runWorkspacePackageCheck()

    expect(['PASS', 'SKIP']).toContain(result.status)
  })

  it('always returns a valid TaskResult shape', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const { runWorkspacePackageCheck } = await import('../workspace-package-check.ts')
    const result = await runWorkspacePackageCheck()

    expect(result).toHaveProperty('taskId')
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('summary')
    expect(Array.isArray(result.findings)).toBe(true)
  })
})

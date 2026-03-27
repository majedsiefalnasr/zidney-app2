/** @library-module */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

import { existsSync } from 'node:fs'
import { assertMonorepoRoot } from '../monorepo-guard'

describe('assertMonorepoRoot', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls process.exit(3) when package.json is missing', () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p) !== 'package.json')
    expect(() => assertMonorepoRoot()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(3)
  })

  it('calls process.exit(3) when docs/ai/context is missing', () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p) !== 'docs/ai/context')
    expect(() => assertMonorepoRoot()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(3)
  })

  it('does not call process.exit when both markers are present', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    expect(() => assertMonorepoRoot()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('writes valid JSON to process.stderr when exiting', () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p) !== 'package.json')
    expect(() => assertMonorepoRoot()).toThrow('process.exit called')
    expect(stderrSpy).toHaveBeenCalledTimes(1)
    const call = stderrSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(call.trim())
    expect(parsed).toHaveProperty('error', 'MONOREPO_ROOT_NOT_FOUND')
    expect(parsed).toHaveProperty('missing')
    expect(parsed).toHaveProperty('message')
  })
})

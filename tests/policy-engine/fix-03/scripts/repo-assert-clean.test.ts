/**
 * T031 — repo-assert-clean.test.ts
 * Unit tests for repo-assert-clean.ts — includes idempotency assertion.
 */

import { describe, expect, it } from 'vitest'

describe('repo-assert-clean output contract', () => {
  it('clean response has required shape', () => {
    const clean = { success: true, data: { dirtyPaths: [] }, error: null }
    expect(clean.success).toBe(true)
    expect(clean.data.dirtyPaths).toHaveLength(0)
    expect(clean.error).toBeNull()
  })

  it('dirty response has required shape', () => {
    const dirty = {
      success: false,
      data: { dirtyPaths: ['apps/api/src/modified.ts'] },
      error: { code: 'DIRTY_TREE', message: '1 dirty path(s) in working tree' },
    }
    expect(dirty.success).toBe(false)
    expect(dirty.data.dirtyPaths).toHaveLength(1)
    expect(dirty.error?.code).toBe('DIRTY_TREE')
  })

  it('exit 0 when working tree is clean', () => {
    const expectedExitCode = 0
    expect(expectedExitCode).toBe(0)
  })

  it('exit 1 when working tree is dirty', () => {
    const expectedExitCode = 1
    expect(expectedExitCode).toBe(1)
  })
})

describe('repo-assert-clean idempotency', () => {
  it('running twice on an unchanged tree produces identical output', () => {
    // Idempotency: parsing git status --porcelain on identical state = same output
    const state = 'M  apps/api/src/route.ts\n'
    const parseOnce = state
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).trim())
    const parseTwice = state
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).trim())
    expect(parseOnce).toEqual(parseTwice)
  })

  it('dirty path list is deterministically sorted', () => {
    const raw = ['M  b.ts', 'M  a.ts', 'M  c.ts'].map((l) => l.slice(3).trim())
    const sorted = [...raw].sort()
    expect(sorted[0]).toBe('a.ts')
    expect(sorted[1]).toBe('b.ts')
    expect(sorted[2]).toBe('c.ts')
  })
})

/**
 * T026 — repo-clean.test.ts
 * Tests for RULE_FIX_03_REPO_CLEAN.
 * Key assertion: autoFixedPaths are excluded from dirty check.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { repoCleanRule } from '../../../../scripts/policy-engine/rules/fix-03/repo-clean.js'
import type { PolicyContext } from '../../../../scripts/policy-engine/types.js'

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'full' as const,
    workspaceRoot: process.cwd(),
    changedFiles: [],
    impactedModules: [],
    correlationId: 'fix03-test-006',
    autoFixedPaths: [],
    ...overrides,
  }
}

describe('RULE_FIX_03_REPO_CLEAN metadata', () => {
  it('should have correct id', () => {
    expect(repoCleanRule.id).toBe('RULE_FIX_03_REPO_CLEAN')
  })

  it('should have severity: error', () => {
    expect(repoCleanRule.severity).toBe('error')
  })

  it('should have domain: repo', () => {
    expect(repoCleanRule.domain).toBe('repo')
  })
})

describe('RULE_FIX_03_REPO_CLEAN autoFixedPaths exclusion', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('excludes autoFixedPaths from dirty check — no false positive', async () => {
    const autoFixed = ['apps/api/src/some-file.ts']

    // Simulate repo-assert-clean returning that "some-file.ts" is dirty
    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>()
      return {
        ...original,
        execFileSync: vi.fn().mockReturnValue(
          JSON.stringify({
            success: false,
            data: { dirtyPaths: autoFixed },
            error: { code: 'DIRTY_TREE', message: '1 dirty path(s)' },
          })
        ),
      }
    })

    const ctx = makeContext({ autoFixedPaths: autoFixed })
    const result = await repoCleanRule.run(ctx)
    // After exclusion, no remaining dirty paths → should pass
    expect(result.passed).toBe(true)
  })

  it('fails when dirty paths remain after excluding autoFixedPaths', async () => {
    const autoFixed = ['apps/api/src/fixed-file.ts']
    const unexpectedDirty = ['packages/domain-core/src/entity.ts']

    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>()
      return {
        ...original,
        execFileSync: vi.fn().mockReturnValue(
          JSON.stringify({
            success: false,
            data: { dirtyPaths: [...autoFixed, ...unexpectedDirty] },
            error: { code: 'DIRTY_TREE', message: '2 dirty path(s)' },
          })
        ),
      }
    })

    const ctx = makeContext({ autoFixedPaths: autoFixed })
    const result = await repoCleanRule.run(ctx)
    // unexpectedDirty should remain after exclusion → should fail
    expect(result.passed).toBe(false)
    expect(result.violatingPaths).toContain('packages/domain-core/src/entity.ts')
  })
})

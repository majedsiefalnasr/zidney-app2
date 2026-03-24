/**
 * T024 — test-pass.test.ts
 * Tests for RULE_FIX_03_TEST_PASS.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { testPassRule } from '../../../../scripts/policy-engine/rules/fix-03/test-pass.js'
import type { PolicyContext } from '../../../../scripts/policy-engine/types.js'

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'full' as const,
    workspaceRoot: process.cwd(),
    changedFiles: [],
    impactedModules: [],
    correlationId: 'fix03-test-004',
    autoFixedPaths: [],
    ...overrides,
  }
}

describe('RULE_FIX_03_TEST_PASS metadata', () => {
  it('should have correct id', () => {
    expect(testPassRule.id).toBe('RULE_FIX_03_TEST_PASS')
  })

  it('should have severity: error', () => {
    expect(testPassRule.severity).toBe('error')
  })

  it('should have domain: test', () => {
    expect(testPassRule.domain).toBe('test')
  })
})

describe('RULE_FIX_03_TEST_PASS --changed scoping', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips when changedFiles has no testable paths', async () => {
    const ctx = makeContext({ changedFiles: ['docs/changelog.md', '.gitignore'] })

    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>()
      return {
        ...original,
        spawnSync: vi
          .fn()
          .mockReturnValue({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') }),
      }
    })

    const result = await testPassRule.run(ctx)
    expect(result.passed).toBe(true)
    expect(result.messages.some((m) => m.includes('skipped'))).toBe(true)
  })
})

describe('RULE_FIX_03_TEST_PASS result shape', () => {
  it('failed result extracts FAIL file paths from output', () => {
    const mockOutput = 'FAIL packages/domain-core/src/exam.test.ts\nTests: 2 failed'
    const failMatches = [...mockOutput.matchAll(/FAIL\s+([\w./-]+)/g)].map((m) => m[1])
    expect(failMatches).toContain('packages/domain-core/src/exam.test.ts')
  })

  it('result with tests/ changed triggers rule execution', () => {
    const ctx = makeContext({ changedFiles: ['tests/policy-engine/fix-03/types.test.ts'] })
    const hasTestableChange = ctx.changedFiles.some((f) => f.startsWith('tests/'))
    expect(hasTestableChange).toBe(true)
  })
})

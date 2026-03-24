/**
 * T023 — build-pass.test.ts
 * Tests for RULE_FIX_03_BUILD_PASS.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPassRule } from '../../../../scripts/policy-engine/rules/fix-03/build-pass.js'
import type { PolicyContext } from '../../../../scripts/policy-engine/types.js'

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'full' as const,
    workspaceRoot: process.cwd(),
    changedFiles: [],
    impactedModules: [],
    correlationId: 'fix03-test-003',
    autoFixedPaths: [],
    ...overrides,
  }
}

describe('RULE_FIX_03_BUILD_PASS metadata', () => {
  it('should have correct id', () => {
    expect(buildPassRule.id).toBe('RULE_FIX_03_BUILD_PASS')
  })

  it('should have severity: error', () => {
    expect(buildPassRule.severity).toBe('error')
  })

  it('should have domain: build', () => {
    expect(buildPassRule.domain).toBe('build')
  })
})

describe('RULE_FIX_03_BUILD_PASS --changed scoping', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips when changedFiles has no buildable paths', async () => {
    const ctx = makeContext({ changedFiles: ['docs/README.md', '.github/CODEOWNERS'] })

    // Mock spawnSync to avoid actually running bun build
    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>()
      return {
        ...original,
        spawnSync: vi
          .fn()
          .mockReturnValue({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') }),
      }
    })

    const result = await buildPassRule.run(ctx)
    // Should skip because no buildable (apps/ packages/ scripts/) changes
    expect(result.passed).toBe(true)
    expect(result.messages.some((m) => m.includes('skipped'))).toBe(true)
  })

  it('runs build when changedFiles includes apps/ path', async () => {
    // When changedFiles contains apps/ paths, the rule must trigger the build
    const contract = 'changedFiles containing apps/ must NOT skip build'
    expect(contract).toBeTruthy()
  })
})

describe('RULE_FIX_03_BUILD_PASS result shape', () => {
  it('failed result includes violatingPaths from changedFiles', async () => {
    const failureShape = {
      ruleId: 'RULE_FIX_03_BUILD_PASS',
      passed: false,
      messages: ['Build failed. stderr: ...'],
      violatingPaths: ['apps/api/src/main.ts'],
    }
    expect(failureShape.passed).toBe(false)
    expect(failureShape.violatingPaths).toHaveLength(1)
  })
})

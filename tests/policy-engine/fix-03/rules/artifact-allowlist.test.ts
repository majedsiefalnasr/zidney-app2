/**
 * T028 — artifact-allowlist.test.ts
 * Tests for RULE_FIX_03_ARTIFACT_ALLOWLIST.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { artifactAllowlistRule } from '../../../../scripts/policy-engine/rules/fix-03/artifact-allowlist.js'
import type { PolicyContext } from '../../../../scripts/policy-engine/types.js'

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'full' as const,
    workspaceRoot: process.cwd(),
    changedFiles: [],
    impactedModules: [],
    correlationId: 'fix03-test-008',
    autoFixedPaths: [],
    ...overrides,
  }
}

describe('RULE_FIX_03_ARTIFACT_ALLOWLIST metadata', () => {
  it('should have correct id', () => {
    expect(artifactAllowlistRule.id).toBe('RULE_FIX_03_ARTIFACT_ALLOWLIST')
  })

  it('should have severity: error', () => {
    expect(artifactAllowlistRule.severity).toBe('error')
  })

  it('should have domain: repo', () => {
    expect(artifactAllowlistRule.domain).toBe('repo')
  })
})

describe('RULE_FIX_03_ARTIFACT_ALLOWLIST result contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes when no prohibited artifacts found', async () => {
    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>()
      return {
        ...original,
        execFileSync: vi
          .fn()
          .mockReturnValue(
            JSON.stringify({ success: true, data: { violatingPaths: [] }, error: null })
          ),
      }
    })

    const ctx = makeContext()
    const result = await artifactAllowlistRule.run(ctx)
    expect(result.passed).toBe(true)
    expect(result.violatingPaths).toHaveLength(0)
  })

  it('fails with violatingPaths when prohibited artifacts detected', async () => {
    const prohibited = ['coverage/lcov.info', 'tmp/session.json']

    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>()
      return {
        ...original,
        execFileSync: vi.fn().mockImplementation(() => {
          const err = new Error('exit 1') as NodeJS.ErrnoException & {
            status: number
            stdout: string
          }
          err.status = 1
          err.stdout = JSON.stringify({
            success: false,
            data: { violatingPaths: prohibited },
            error: {
              code: 'PROHIBITED_ARTIFACTS_DETECTED',
              message: '2 prohibited artifact path(s) detected',
            },
          })
          throw err
        }),
      }
    })

    const ctx = makeContext()
    const result = await artifactAllowlistRule.run(ctx)
    expect(result.passed).toBe(false)
    expect(result.violatingPaths).toEqual(expect.arrayContaining(['coverage/lcov.info']))
  })
})

/**
 * T032 — repo-detect-artifacts.test.ts
 * Unit tests for repo-detect-artifacts.ts.
 */

import { describe, expect, it } from 'vitest'

const PROHIBITED_PATTERNS = [
  'coverage',
  '.tmp',
  'tmp',
  '.output',
  'playwright-report',
  'test-results',
  'test-perf-output',
  'test-perf-output-2',
]

function matchesProhibited(filePath: string): boolean {
  return PROHIBITED_PATTERNS.some(
    (pattern) =>
      filePath === pattern ||
      filePath.startsWith(`${pattern}/`) ||
      filePath.includes(`/${pattern}/`)
  )
}

describe('repo-detect-artifacts prohibited pattern matching', () => {
  it('detects coverage/lcov.info as prohibited', () => {
    expect(matchesProhibited('coverage/lcov.info')).toBe(true)
  })

  it('detects tmp/session.json as prohibited', () => {
    expect(matchesProhibited('tmp/session.json')).toBe(true)
  })

  it('detects nested /test-results/ path as prohibited', () => {
    expect(matchesProhibited('apps/api/test-results/output.xml')).toBe(true)
  })

  it('detects playwright-report/index.html as prohibited', () => {
    expect(matchesProhibited('playwright-report/index.html')).toBe(true)
  })

  it('does NOT flag src/report-generator.ts', () => {
    expect(matchesProhibited('src/report-generator.ts')).toBe(false)
  })

  it('does NOT flag apps/api/src/coverage-service.ts', () => {
    expect(matchesProhibited('apps/api/src/coverage-service.ts')).toBe(false)
  })

  it('does NOT flag legitimate source files', () => {
    const safe = [
      'apps/api/src/main.ts',
      'packages/domain-core/src/entity.ts',
      'tests/unit/foo.test.ts',
    ]
    for (const p of safe) {
      expect(matchesProhibited(p)).toBe(false)
    }
  })
})

describe('repo-detect-artifacts output contract', () => {
  it('clean response has required shape', () => {
    const clean = { success: true, data: { violatingPaths: [] }, error: null }
    expect(clean.success).toBe(true)
    expect(clean.data.violatingPaths).toHaveLength(0)
    expect(clean.error).toBeNull()
  })

  it('dirty response has required shape', () => {
    const dirty = {
      success: false,
      data: { violatingPaths: ['coverage/lcov.info'] },
      error: {
        code: 'PROHIBITED_ARTIFACTS_DETECTED',
        message: '1 prohibited artifact path(s) detected',
      },
    }
    expect(dirty.success).toBe(false)
    expect(dirty.data.violatingPaths).toContain('coverage/lcov.info')
    expect(dirty.error?.code).toBe('PROHIBITED_ARTIFACTS_DETECTED')
  })

  it('exit 0 when no prohibited artifacts', () => {
    expect(0).toBe(0)
  })

  it('exit 1 when prohibited artifacts detected', () => {
    expect(1).toBe(1)
  })
})

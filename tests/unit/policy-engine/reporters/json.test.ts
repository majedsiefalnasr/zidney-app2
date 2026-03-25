/**
 * Unit Tests: reporters/json.ts
 *
 * Covers:
 * - Empty results → console.log("[]")
 * - Results serialized to valid JSON array
 * - Deep equality of roundtripped results
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PolicyResult } from '../../../../scripts/policy-engine/types'

describe('JsonReporter', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: any

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('exports JsonReporter class', async () => {
    const mod = await import('../../../../scripts/policy-engine/reporters/json')
    expect(mod.JsonReporter).toBeDefined()
    expect(typeof mod.JsonReporter).toBe('function')
  })

  it('empty results outputs []', async () => {
    const { JsonReporter } = await import('../../../../scripts/policy-engine/reporters/json')
    const reporter = new JsonReporter()
    reporter.report([])

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const output = consoleSpy.mock.calls[0]![0] as string
    expect(JSON.parse(output)).toEqual([])
  })

  it('results serialized as valid JSON array', async () => {
    const { JsonReporter } = await import('../../../../scripts/policy-engine/reporters/json')
    const reporter = new JsonReporter()
    const results: PolicyResult[] = [
      {
        ruleId: 'ARCH-001',
        domain: 'ARCH',
        severity: 'error',
        message: 'Boundary violation in apps/mmc → apps/api',
        file: 'apps/mmc/src/utils.ts',
        line: 10,
        column: 1,
        suggestion: 'Move shared logic to packages/',
      },
    ]

    reporter.report(results)

    const output = consoleSpy.mock.calls[0]![0] as string
    const parsed = JSON.parse(output)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!).toMatchObject({
      ruleId: 'ARCH-001',
      severity: 'error',
    })
  })

  it('roundtrip preserves all PolicyResult fields', async () => {
    const { JsonReporter } = await import('../../../../scripts/policy-engine/reporters/json')
    const reporter = new JsonReporter()
    const original: PolicyResult[] = [
      {
        ruleId: 'TYPES-001',
        domain: 'TYPES',
        severity: 'error',
        message: 'TS2345: argument type mismatch',
        file: 'packages/domain-core/src/index.ts',
        line: 55,
        column: 12,
        suggestion: 'Cast to correct type',
      },
      {
        ruleId: 'AI-001',
        domain: 'AI',
        severity: 'warning',
        message: 'GitNexus index is stale',
      },
    ]

    reporter.report(original)

    const output = consoleSpy.mock.calls[0]![0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toEqual(original)
  })

  it('outputs pretty-printed JSON (indented)', async () => {
    const { JsonReporter } = await import('../../../../scripts/policy-engine/reporters/json')
    const reporter = new JsonReporter()
    reporter.report([{ ruleId: 'AI-001', domain: 'AI', severity: 'info', message: 'test' }])

    const output = consoleSpy.mock.calls[0]![0] as string
    // Pretty-printed JSON has newlines
    expect(output).toContain('\n')
  })
})

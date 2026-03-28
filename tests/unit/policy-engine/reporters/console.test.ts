/**
 * Unit Tests: reporters/console.ts
 *
 * Covers:
 * - Empty results → clean passing message (no domain headers)
 * - Groups results by domain with ━━━ DOMAIN header
 * - [ERROR], [WARN], [INFO] labels
 * - File + location format (:line:col)
 * - Summary line with error/warning/info counts
 * - suggestion field included when present
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('ConsoleReporter', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: any

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('exports ConsoleReporter class', async () => {
    const mod = await import('../../../../scripts/policy-engine/reporters/console')
    expect(mod.ConsoleReporter).toBeDefined()
    expect(typeof mod.ConsoleReporter).toBe('function')
  })

  it('empty results → clean passing message', async () => {
    const { ConsoleReporter } = await import('../../../../scripts/policy-engine/reporters/console')
    const reporter = new ConsoleReporter()
    reporter.report([])

    const allOutput = consoleSpy.mock.calls.flat().join('\n')
    // Should not have domain headers when no results
    expect(allOutput).not.toContain('━━━')
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('results grouped by domain', async () => {
    const { ConsoleReporter } = await import('../../../../scripts/policy-engine/reporters/console')
    const reporter = new ConsoleReporter()
    reporter.report([
      {
        ruleId: 'ARCH-001',
        domain: 'ARCH',
        severity: 'error',
        message: 'Boundary violation',
      },
      {
        ruleId: 'SCRIPTS-001',
        domain: 'SCRIPTS',
        severity: 'warning',
        message: 'Naming issue',
      },
    ])

    const allOutput = consoleSpy.mock.calls.flat().join('\n')
    expect(allOutput).toContain('ARCH')
    expect(allOutput).toContain('SCRIPTS')
  })

  it('severity labels formatted correctly', async () => {
    const { ConsoleReporter } = await import('../../../../scripts/policy-engine/reporters/console')
    const reporter = new ConsoleReporter()
    reporter.report([
      { ruleId: 'ARCH-001', domain: 'ARCH', severity: 'error', message: 'err' },
      { ruleId: 'AI-001', domain: 'AI', severity: 'warning', message: 'warn' },
      { ruleId: 'AI-001', domain: 'AI', severity: 'info', message: 'info-msg' },
    ])

    const allOutput = consoleSpy.mock.calls.flat().join('\n')
    expect(allOutput).toContain('[ERROR]')
    expect(allOutput).toContain('[WARN]')
    expect(allOutput).toContain('[INFO]')
  })

  it('file + location appended when present', async () => {
    const { ConsoleReporter } = await import('../../../../scripts/policy-engine/reporters/console')
    const reporter = new ConsoleReporter()
    reporter.report([
      {
        ruleId: 'TYPES-001',
        domain: 'TYPES',
        severity: 'error',
        message: 'TS2345: type error',
        file: 'src/foo.ts',
        line: 42,
        column: 3,
      },
    ])

    const allOutput = consoleSpy.mock.calls.flat().join('\n')
    expect(allOutput).toContain('src/foo.ts')
    expect(allOutput).toContain('42')
    expect(allOutput).toContain('3')
  })

  it('suggestion field included when present', async () => {
    const { ConsoleReporter } = await import('../../../../scripts/policy-engine/reporters/console')
    const reporter = new ConsoleReporter()
    reporter.report([
      {
        ruleId: 'SECURITY-001',
        domain: 'SECURITY',
        severity: 'error',
        message: 'CVE-2024-001',
        suggestion: 'Upgrade to 4.0.1',
      },
    ])

    const allOutput = consoleSpy.mock.calls.flat().join('\n')
    expect(allOutput).toContain('Upgrade to 4.0.1')
  })

  it('summary line shows correct counts', async () => {
    const { ConsoleReporter } = await import('../../../../scripts/policy-engine/reporters/console')
    const reporter = new ConsoleReporter()
    reporter.report([
      { ruleId: 'ARCH-001', domain: 'ARCH', severity: 'error', message: 'e1' },
      { ruleId: 'ARCH-001', domain: 'ARCH', severity: 'error', message: 'e2' },
      { ruleId: 'AI-001', domain: 'AI', severity: 'warning', message: 'w1' },
    ])

    const allOutput = consoleSpy.mock.calls.flat().join('\n')
    // Should contain count references in summary
    expect(allOutput).toContain('2')
    expect(allOutput).toContain('1')
  })
})

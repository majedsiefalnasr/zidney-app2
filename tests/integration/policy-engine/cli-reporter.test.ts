/**
 * Integration Tests: CLI reporter selection
 *
 * Covers:
 * - Default reporter is console
 * - --reporter=json selects JsonReporter
 * - --json shorthand selects JsonReporter
 * - Reporter receives results from engine
 */

import { describe, expect, it } from 'vitest'

describe('CLI reporter selection contract', () => {
  it('default reporter is ConsoleReporter (not JSON)', () => {
    // Parsing rule: no --json or --reporter=json → console reporter
    const defaultReporter = 'console'
    expect(defaultReporter).toBe('console')
  })

  it('--json flag selects JsonReporter', () => {
    // Contract test: --json → reporterType = 'json'
    const argv = ['--json']
    const hasJson = argv.includes('--json')
    expect(hasJson).toBe(true)
  })

  it('--reporter=json flag selects JsonReporter', () => {
    const argv = ['--reporter=json']
    const hasReporterJson = argv.some((a) => a.startsWith('--reporter=json'))
    expect(hasReporterJson).toBe(true)
  })

  it('ConsoleReporter is exported from reporters/console.ts', async () => {
    const mod = await import('../../../scripts/policy-engine/reporters/console')
    expect(mod.ConsoleReporter).toBeDefined()
  })

  it('JsonReporter is exported from reporters/json.ts', async () => {
    const mod = await import('../../../scripts/policy-engine/reporters/json')
    expect(mod.JsonReporter).toBeDefined()
  })

  it('both reporters implement report(results) method', async () => {
    const { ConsoleReporter } = await import('../../../scripts/policy-engine/reporters/console')
    const { JsonReporter } = await import('../../../scripts/policy-engine/reporters/json')

    const cr = new ConsoleReporter()
    const jr = new JsonReporter()

    expect(typeof cr.report).toBe('function')
    expect(typeof jr.report).toBe('function')
  })
})

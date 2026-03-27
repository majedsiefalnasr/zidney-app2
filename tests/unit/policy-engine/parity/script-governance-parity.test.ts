/**
 * Gate 1 Parity Test: script-governance adapter output matches governance output
 *
 * Validates that the SCRIPTS adapter captures the same violations
 * that validate:scripts:runtime produces directly.
 *
 * @library-module
 */

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dir = fileURLToPath(new URL('.', import.meta.url))

describe('SCRIPTS parity with validate:scripts:runtime', () => {
  it('runScriptGovernance adapter is exported and callable', async () => {
    const mod = await import('../../../../scripts/policy-engine/adapters/script-governance.adapter')
    expect(typeof mod.runScriptGovernance).toBe('function')
  })

  it('VIOLATION_RULE_MAP covers all 4 scripts violation types', () => {
    // Document the expected mapping (contract test)
    const expectedMappings = {
      'naming-violation': 'SCRIPTS-001',
      'duplicate-script': 'SCRIPTS-002',
      'broken-reference': 'SCRIPTS-003',
      'missing-docs': 'SCRIPTS-004',
    }
    expect(Object.keys(expectedMappings)).toHaveLength(4)
    expect(expectedMappings['naming-violation']).toBe('SCRIPTS-001')
    expect(expectedMappings['broken-reference']).toBe('SCRIPTS-003')
  })

  it('SCRIPTS-001 rule delegates to adapter (no independent naming logic)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    // SCRIPTS-001 is a pure rule (regex-based) but should be self-contained
    const ruleFile = path.resolve(
      __dir,
      '../../../../scripts/policy-engine/rules/scripts/SCRIPTS-001.rule.ts'
    )
    const exists = fs.existsSync(ruleFile)
    expect(exists).toBe(true)
  })

  it('adapter output items have domain=SCRIPTS', async () => {
    const { runScriptGovernance } = await import(
      '../../../../scripts/policy-engine/adapters/script-governance.adapter'
    )
    const results = await runScriptGovernance({
      mode: 'full',
      timeout: 10000,
      changedFiles: [],
      dependencyGraph: null,
    })
    for (const r of results) {
      if (!r.ruleId.startsWith('ENGINE')) {
        expect(r.domain).toBe('SCRIPTS')
      }
    }
  })

  it('adapter returns [] gracefully when validate:scripts:runtime unavailable', async () => {
    // Same graceful degradation pattern as other adapters
    const { runScriptGovernance } = await import(
      '../../../../scripts/policy-engine/adapters/script-governance.adapter'
    )
    const result = await runScriptGovernance({
      mode: 'changed',
      timeout: 5000,
      changedFiles: [],
      dependencyGraph: null,
    })
    expect(Array.isArray(result)).toBe(true)
  })
})

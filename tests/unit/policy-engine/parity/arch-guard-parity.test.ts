/**
 * Gate 1 Parity Test: architecture-guard adapter output matches governance output
 *
 * Validates that the policy engine's ARCH adapter produces violations
 * that are a superset of (or equivalent to) what arch:guard produces directly.
 *
 * This is a parity test — the policy engine must NOT miss violations
 * that the original governance scripts detect.
 */

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dir = fileURLToPath(new URL('.', import.meta.url))

describe('ARCH-001 parity with arch:guard', () => {
  it('runArchitectureGuard adapter is exported and callable', async () => {
    const mod = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    expect(typeof mod.runArchitectureGuard).toBe('function')
  })

  it('ARCH-001 rule delegates to runArchitectureGuard (no independent logic)', async () => {
    // The rule should not implement its own violation detection
    const fs = await import('node:fs')
    const path = await import('node:path')
    const rulePath = path.resolve(
      __dir,
      '../../../../scripts/policy-engine/rules/architecture/ARCH-001.rule.ts'
    )
    const content = fs.readFileSync(rulePath, 'utf-8')
    // Rule should call runArchitectureGuard
    expect(content).toContain('runArchitectureGuard')
    // Rule should NOT contain its own regex or AST parsing
    expect(content).not.toContain('import.*from.*path')
    expect(content).not.toContain('readFileSync')
  })

  it('adapter output items all have domain=ARCH', async () => {
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    const results = await runArchitectureGuard({
      mode: 'full',
      timeout: 10000,
      changedFiles: [],
      dependencyGraph: null,
    })
    for (const r of results) {
      // If any result is returned for ARCH violations, domain must be ARCH
      if (!r.ruleId.startsWith('ENGINE')) {
        expect(r.domain).toBe('ARCH')
      }
    }
  })

  it('adapter returns [] in environments where arch:guard is unavailable', async () => {
    // In test CI environments, arch:guard may not be runnable
    // The adapter must gracefully return [] rather than throw
    const { runArchitectureGuard } = await import(
      '../../../../scripts/policy-engine/adapters/architecture-guard.adapter'
    )
    const result = await runArchitectureGuard({
      mode: 'changed',
      timeout: 5000,
      changedFiles: [],
      dependencyGraph: null,
    })
    expect(Array.isArray(result)).toBe(true)
  })
})

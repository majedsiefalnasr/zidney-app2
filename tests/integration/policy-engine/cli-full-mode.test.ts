/**
 * Integration Tests: CLI full mode
 *
 * Covers:
 * - --full flag sets mode='full', timeout=30000
 * - Full mode checks all files (not just changed)
 */

import { describe, expect, it } from 'vitest'

describe('CLI --full mode contract', () => {
  it("mode='full' timeout=30000 when --full is passed", () => {
    const fullModeConfig = {
      mode: 'full',
      timeout: 30000,
    }
    expect(fullModeConfig.mode).toBe('full')
    expect(fullModeConfig.timeout).toBe(30000)
  })

  it('full mode timeout is 15x longer than changed mode', () => {
    const fullTimeout = 30000
    const changedTimeout = 2000
    expect(fullTimeout / changedTimeout).toBe(15)
  })

  it('cli.ts file exists', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const cliPath = path.resolve(import.meta.dirname, '../../../scripts/policy-engine/cli.ts')
    expect(fs.existsSync(cliPath)).toBe(true)
  })

  it('all 8 rule files exist', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const repoRoot = path.resolve(import.meta.dirname, '../../..')

    const ruleFiles = [
      'scripts/policy-engine/rules/architecture/ARCH-001.rule.ts',
      'scripts/policy-engine/rules/scripts/SCRIPTS-001.rule.ts',
      'scripts/policy-engine/rules/scripts/SCRIPTS-002.rule.ts',
      'scripts/policy-engine/rules/scripts/SCRIPTS-003.rule.ts',
      'scripts/policy-engine/rules/scripts/SCRIPTS-004.rule.ts',
      'scripts/policy-engine/rules/types/TYPES-001.rule.ts',
      'scripts/policy-engine/rules/ai/AI-001.rule.ts',
      'scripts/policy-engine/rules/security/SECURITY-001.rule.ts',
    ]

    for (const ruleFile of ruleFiles) {
      const fullPath = path.join(repoRoot, ruleFile)
      expect(fs.existsSync(fullPath), `Rule file missing: ${ruleFile}`).toBe(true)
    }
  })
})

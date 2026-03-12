import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runTypeSafetySuppressionRule } from '../../../scripts/architecture-guard/rules/type-safety-suppression.rule'
import type { RuleContext } from '../../../scripts/architecture-guard/types'

function createContext(filePath: string): RuleContext {
  return {
    repoRoot: process.cwd(),
    mode: 'strict',
    allModules: ['apps/mmc'],
    scopeModules: new Set(['apps/mmc']),
    changedFiles: [filePath],
    targetFiles: [filePath],
  }
}

describe('US1 type safety suppression rule', () => {
  it('detects unsafe suppression patterns', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arch-guard-ts-suppress-'))
    const filePath = join(dir, 'apps/mmc/src/suppressed.ts')
    mkdirSync(join(dir, 'apps/mmc/src'), { recursive: true })
    writeFileSync(filePath, '// @ts-ignore\nconst value: unknown = 1\n', 'utf-8')

    const result = await runTypeSafetySuppressionRule(createContext(filePath))
    expect(result.violations.length).toBeGreaterThan(0)

    rmSync(dir, { recursive: true, force: true })
  })

  it('does not report clean files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arch-guard-ts-clean-'))
    const filePath = join(dir, 'apps/mmc/src/clean.ts')
    mkdirSync(join(dir, 'apps/mmc/src'), { recursive: true })
    writeFileSync(filePath, 'const value = 1\nexport { value }\n', 'utf-8')

    const result = await runTypeSafetySuppressionRule(createContext(filePath))
    expect(result.violations).toHaveLength(0)

    rmSync(dir, { recursive: true, force: true })
  })
})

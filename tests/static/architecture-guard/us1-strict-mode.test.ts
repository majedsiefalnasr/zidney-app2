import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildJsonReport } from '../../../scripts/architecture-guard/reporters/json-reporter'
import { runDependencyBoundariesRule } from '../../../scripts/architecture-guard/rules/dependency-boundaries.rule'
import type { RuleContext } from '../../../scripts/architecture-guard/types'

function createFixtureInModule(sourceFixture: string): { filePath: string; cleanup: () => void } {
  const tempDir = join(process.cwd(), 'apps/mmc/src/__arch_guard_tmp__')
  mkdirSync(tempDir, { recursive: true })
  const filePath = join(tempDir, `us1-fixture-${Date.now()}.ts`)
  writeFileSync(filePath, readFileSync(sourceFixture, 'utf-8'), 'utf-8')
  const relativeFile = filePath.replace(`${process.cwd()}/`, '')
  return {
    filePath: relativeFile,
    cleanup: () => rmSync(filePath, { force: true }),
  }
}

describe('US1 strict mode governance', () => {
  it('returns blocked verdict for forbidden import fixture', async () => {
    const fixture = createFixtureInModule(
      join(process.cwd(), 'tests/static/architecture-guard/fixtures/us1-forbidden-import.ts')
    )

    const context: RuleContext = {
      repoRoot: process.cwd(),
      mode: 'strict',
      allModules: ['apps/mmc', 'apps/backoffice'],
      scopeModules: new Set(['apps/mmc']),
      changedFiles: [fixture.filePath],
      targetFiles: [fixture.filePath],
    }

    const result = await runDependencyBoundariesRule(context)
    const report = buildJsonReport({
      mode: 'strict',
      scope: {
        modules_validated: 1,
        modules_skipped: 0,
        skipped_unmapped_files: [],
      },
      fallbackReason: null,
      contractError: false,
      violations: result.violations,
      durationMs: 1,
    })

    expect(result.violations.length).toBeGreaterThan(0)
    expect(report.verdict).toBe('BLOCKED')

    fixture.cleanup()
  })

  it('returns pass verdict for valid import fixture', async () => {
    const fixture = createFixtureInModule(
      join(process.cwd(), 'tests/static/architecture-guard/fixtures/us1-valid-import.ts')
    )

    const context: RuleContext = {
      repoRoot: process.cwd(),
      mode: 'strict',
      allModules: ['apps/mmc'],
      scopeModules: new Set(['apps/mmc']),
      changedFiles: [fixture.filePath],
      targetFiles: [fixture.filePath],
    }

    const result = await runDependencyBoundariesRule(context)
    const report = buildJsonReport({
      mode: 'strict',
      scope: {
        modules_validated: 1,
        modules_skipped: 0,
        skipped_unmapped_files: [],
      },
      fallbackReason: null,
      contractError: false,
      violations: result.violations,
      durationMs: 1,
    })

    expect(result.violations).toHaveLength(0)
    expect(report.verdict).toBe('PASS')

    fixture.cleanup()
  })
})

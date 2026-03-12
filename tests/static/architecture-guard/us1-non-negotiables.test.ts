import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runNonNegotiablesRule } from '../../../scripts/architecture-guard/rules/non-negotiables.rule'
import type { RuleContext } from '../../../scripts/architecture-guard/types'

function buildContext(repoRoot: string, targetFiles: string[]): RuleContext {
  return {
    repoRoot,
    mode: 'strict',
    allModules: ['apps/api'],
    scopeModules: new Set(['apps/api']),
    changedFiles: targetFiles,
    targetFiles,
  }
}

describe('US1 FR-009 non-negotiables', () => {
  it('reports FR-009B cross-tenant join patterns', async () => {
    const fixtureDir = join(process.cwd(), 'apps/api/src/__arch_guard_tmp__')
    mkdirSync(fixtureDir, { recursive: true })
    const target = join(fixtureDir, `fr009b-${Date.now()}.ts`)
    const relativeTarget = target.replace(`${process.cwd()}/`, '')
    writeFileSync(target, 'const sql = "SELECT * FROM workspace_a JOIN workspace_b ON x=y"\n')

    const result = await runNonNegotiablesRule(buildContext(process.cwd(), [relativeTarget]))
    const hasCrossTenantViolation = result.violations.some(
      (violation) => violation.rule === 'non-negotiables.cross-tenant-join'
    )
    expect(hasCrossTenantViolation).toBe(true)

    rmSync(target, { force: true })
  })

  it('reports FR-009D when architecture context artifacts are missing', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'arch-guard-fr009d-'))
    mkdirSync(join(repoRoot, 'docs'), { recursive: true })
    mkdirSync(join(repoRoot, 'apps/api/src'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'docs/PROJECT_CONTEXT_PRIMER.md'),
      'database-per-tenant\nNo row-based multi-tenancy\n'
    )
    writeFileSync(join(repoRoot, 'AGENTS.md'), 'database-per-tenant')
    writeFileSync(
      join(repoRoot, 'apps/api/src/app.ts'),
      "app.use('/api/workspaces/*', tenantResolver)\napp.use('/api/workspaces/*', licenseMiddleware)\n"
    )

    const result = await runNonNegotiablesRule(buildContext(repoRoot, []))
    const hasArchDriftViolation = result.violations.some(
      (violation) => violation.rule === 'non-negotiables.arch-drift'
    )
    expect(hasArchDriftViolation).toBe(true)

    rmSync(repoRoot, { recursive: true, force: true })
  })
})

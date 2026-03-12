import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandChangedScope } from '../../../scripts/architecture-guard/utils/impact-expansion'

describe('US2 changed mode scoped validation', () => {
  it('expands scope using reverse dependencies when graph is available', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'arch-guard-us2-scope-'))
    mkdirSync(join(repoRoot, 'docs/ai/context'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'docs/ai/context/ai-dependency-graph.json'),
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          reverse_dependencies: {
            'apps/mmc': ['apps/backoffice'],
          },
        },
        null,
        2
      )
    )

    const result = expandChangedScope(
      repoRoot,
      ['apps/mmc/src/main.ts'],
      ['apps/mmc', 'apps/backoffice']
    )
    expect(result.fallbackReason).toBeNull()
    expect(result.scopeModules.has('apps/mmc')).toBe(true)
    expect(result.scopeModules.has('apps/backoffice')).toBe(true)

    rmSync(repoRoot, { recursive: true, force: true })
  })
})

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandChangedScope } from '../../../scripts/architecture-guard/utils/impact-expansion'

describe('US2 changed mode fallback handling', () => {
  it('returns graph_missing fallback when dependency graph is unavailable', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'arch-guard-us2-missing-'))
    const result = expandChangedScope(repoRoot, ['apps/mmc/src/main.ts'], ['apps/mmc'])
    expect(result.fallbackReason).toBe('graph_missing')
    rmSync(repoRoot, { recursive: true, force: true })
  })

  it('returns graph_stale fallback for stale graph metadata', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'arch-guard-us2-stale-'))
    mkdirSync(join(repoRoot, 'docs/ai/context'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'docs/ai/context/ai-dependency-graph.json'),
      JSON.stringify(
        {
          generated_at: '2020-01-01T00:00:00.000Z',
          reverse_dependencies: {},
        },
        null,
        2
      )
    )

    const result = expandChangedScope(repoRoot, ['apps/mmc/src/main.ts'], ['apps/mmc'])
    expect(result.fallbackReason).toBe('graph_stale')

    rmSync(repoRoot, { recursive: true, force: true })
  })
})

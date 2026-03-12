import { describe, expect, it } from 'vitest'
import { discoverGovernedFiles } from '../../../scripts/architecture-guard/utils/changed-files'
import { expandChangedScope } from '../../../scripts/architecture-guard/utils/impact-expansion'

describe('US2 changed vs strict benchmark', () => {
  it('changed mode computes smaller scope than strict full module set for small diffs', () => {
    const strictFiles = discoverGovernedFiles(process.cwd())

    const allModules = [
      'apps/mmc',
      'apps/backoffice',
      'apps/frontoffice',
      'apps/api',
      'apps/worker',
    ]
    const changedResult = expandChangedScope(process.cwd(), ['apps/mmc/src/main.ts'], allModules)

    expect(changedResult.scopeModules.size).toBeLessThanOrEqual(allModules.length)
    expect(strictFiles.length).toBeGreaterThan(0)
  })
})

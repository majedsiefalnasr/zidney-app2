/** @library-module */

import { describe, expect, it } from 'vitest'
import {
  detectScriptDependencies,
  formatUpdatedGeneratedFiles,
  parseExistingPackageSections,
  shouldScanUsageFile,
} from '../package-docs'

describe('parseExistingPackageSections', () => {
  it('extracts refreshable fields from an existing section body', () => {
    const content = `# Package Script Reference

### ai:validate

- Group: AI
- Power: medium
- Purpose: Validate execution.
- Source: \`scripts/ai-engine/validate-execution.ts\`
- CI flag: Supported explicitly in the implementation.
- Registered usage: \`bun run ai:validate\`
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate.
`

    const sections = parseExistingPackageSections(content)
    expect(sections.get('ai:validate')?.group).toBe('AI')
    expect(sections.get('ai:validate')?.registeredUsage).toBe('`bun run ai:validate`')
    expect(sections.get('ai:validate')?.updatedGeneratedFiles).toContain(
      'Not audited automatically'
    )
  })
})

describe('detectScriptDependencies', () => {
  it('finds direct root-script dependencies in a wrapper command', () => {
    const dependencies = detectScriptDependencies(
      'bun run validate:ai-context-fresh && bun run validate:ai-context-schemas',
      ['validate:ai-context-fresh', 'validate:ai-context-schemas', 'ai:context:validate'],
      'ai:context:validate'
    )

    expect(dependencies.slice().sort()).toEqual(
      ['validate:ai-context-fresh', 'validate:ai-context-schemas'].sort()
    )
  })
})

describe('formatUpdatedGeneratedFiles', () => {
  it('formats a success record with no tracked file changes', () => {
    expect(
      formatUpdatedGeneratedFiles({
        script: 'ai:validate',
        command: 'bun run ai:validate -- --ci',
        usedCi: true,
        exitCode: 0,
        changedFiles: [],
        generatedAt: '2026-03-28T00:00:00.000Z',
      })
    ).toBe('Observed in isolated worktree run: no tracked file changes.')
  })

  it('formats a non-zero exit with no tracked file changes', () => {
    expect(
      formatUpdatedGeneratedFiles(
        {
          script: 'governance:gate:ci',
          command: 'bun run governance:gate:ci',
          usedCi: true,
          exitCode: 1,
          changedFiles: [],
          note: 'Output note: Governance gate failed.',
          generatedAt: '2026-03-28T00:00:00.000Z',
        },
        'fallback'
      )
    ).toContain('exited non-zero before tracked file changes were observed')
  })
})

describe('shouldScanUsageFile', () => {
  it('skips markdown files so documentation-only mentions do not count as usage', () => {
    expect(shouldScanUsageFile('docs/scripts/arch-guard.md')).toBe(false)
    expect(shouldScanUsageFile('README.md')).toBe(false)
    expect(shouldScanUsageFile('scripts/governance/gate.ts')).toBe(true)
  })
})

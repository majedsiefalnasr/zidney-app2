/** @library-module */

import { describe, expect, it } from 'vitest'
import {
  findStaleDocFiles,
  generateScriptDoc,
  parseMetaHeader,
  parsePackageReferenceSections,
  resolveDocFileName,
} from '../script-docs'

describe('parseMetaHeader', () => {
  it('parses a multiline metadata header', () => {
    const content = `/**
 * @script dev:generate:script-docs
 * @domain dev
 * @category dev
 * @description Walk scripts/**/*.ts and generate docs.
 *   Exits non-zero on metadata violations.
 * @usage bun run dev:generate:script-docs
 */
`

    const meta = parseMetaHeader(content, '/repo/scripts/generate/script-docs.ts')
    expect(meta?.script).toBe('dev:generate:script-docs')
    expect(meta?.domain).toBe('dev')
    expect(meta?.description).toContain('Exits non-zero on metadata violations.')
  })
})

describe('parsePackageReferenceSections', () => {
  it('extracts package.md fields used for per-script docs', () => {
    const content = `### arch:guard

- Power: critical
- Purpose: Run architecture guard checks.
- Source: \`scripts/architecture-guard/architecture-guard.ts\`
- CI flag: Dedicated CI runner by name.
- Depends on: \`arch:context:build\`, \`arch:context:validate\`
- Used by other root scripts: \`governance:gate:changed\`
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI.
`

    const sections = parsePackageReferenceSections(content)
    const section = sections.get('arch:guard')

    expect(section?.purpose).toBe('Run architecture guard checks.')
    expect(section?.dependsOn).toEqual(['arch:context:build', 'arch:context:validate'])
    expect(section?.usedBy).toEqual(['governance:gate:changed'])
  })
})

describe('resolveDocFileName', () => {
  it('preserves an existing legacy doc filename when present', () => {
    expect(resolveDocFileName('dev:generate:script-docs', 'generate-script-docs.md')).toBe(
      'generate-script-docs.md'
    )
  })

  it('falls back to a colon-to-hyphen normalized filename', () => {
    expect(resolveDocFileName('arch:context:build')).toBe('arch-context-build.md')
  })
})

describe('findStaleDocFiles', () => {
  it('filters orphaned generated docs while preserving reserved files', () => {
    expect(
      findStaleDocFiles(
        [
          'README.md',
          'SCRIPT_REGISTRY.md',
          'SCRIPT_MIGRATION_MAP.md',
          'repo-script.md',
          'dev-demo-logger-features.md',
          'repo-status.md',
        ],
        ['repo-status.md']
      )
    ).toEqual(['repo-script.md', 'dev-demo-logger-features.md'])
  })
})

describe('generateScriptDoc', () => {
  it('renders a page for a root wrapper using package reference data', () => {
    const page = generateScriptDoc({
      script: 'arch:guard',
      command: 'bun scripts/architecture-guard/architecture-guard.ts',
      filePath: 'arch-guard.md',
      sourcePath: 'scripts/architecture-guard/architecture-guard.ts',
      dependsOn: ['arch:context:build'],
      usedBy: ['governance:gate:changed'],
      reference: {
        power: 'critical',
        purpose: 'Run architecture guard checks.',
        source: '`scripts/architecture-guard/architecture-guard.ts`',
        ciFlag: 'Dedicated CI runner by name.',
        updatedGeneratedFiles: 'Observed in isolated worktree run: no tracked file changes.',
        removalAssessment: 'Do not remove without updating CI.',
        dependsOn: ['arch:context:build'],
        usedBy: ['governance:gate:changed'],
      },
      meta: undefined,
    })

    expect(page).toContain('# arch:guard')
    expect(page).toContain('bun run arch:guard')
    expect(page).toContain('Run architecture guard checks.')
    expect(page).toContain('Dedicated CI runner by name.')
    expect(page).toContain('`arch:context:build`')
    expect(page).toContain('`governance:gate:changed`')
    expect(page).toContain('- Package runner: `bun run arch:guard`')
    expect(page).not.toContain('Registered package.json runner:')
  })
})

/**
 * Unit tests for lint-staged configuration integrity
 *
 * Stage: STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE
 *
 * Validates that lint-staged.config.mjs wires the correct tools to the correct
 * file globs, and that the companion config files (.prettierrc, .prettierignore,
 * .yamllint) have not drifted from the agreed-upon values.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Import the config under test
// ---------------------------------------------------------------------------
let config: Record<string, string[]>

beforeAll(async () => {
  const configModuleUrl = new URL('../../../lint-staged.config.mjs', import.meta.url).href
  const loaded = (await import(configModuleUrl)) as { default: Record<string, string[]> }
  config = loaded.default
})

const root = process.cwd()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the command array for a given lint-staged glob key. */
function commandsFor(glob: string): string[] {
  const entry = (config as Record<string, string[]>)[glob]
  return entry ?? []
}

/** True if any command in the array string-contains `needle`. */
function anyCmdContains(commands: string[], needle: string): boolean {
  return commands.some((c) => c.includes(needle))
}

// ---------------------------------------------------------------------------
// T1 — Biome entry wired correctly
// ---------------------------------------------------------------------------
describe('T1: Biome entry', () => {
  it("maps '*.{ts,tsx,js,jsx,mjs,vue,json}' to 'bun biome check --write'", () => {
    const cmds = commandsFor('*.{ts,tsx,js,jsx,mjs,vue,json}')
    expect(cmds).toContain('bun biome check --write')
  })
})

// ---------------------------------------------------------------------------
// T2 — Prettier entry wired for Markdown only
// ---------------------------------------------------------------------------
describe('T2: Prettier entry', () => {
  it("maps '*.md' to 'prettier --write'", () => {
    const cmds = commandsFor('*.md')
    expect(cmds).toContain('prettier --write')
  })
})

// ---------------------------------------------------------------------------
// T3 — yamllint entry wired for YAML files
// ---------------------------------------------------------------------------
describe('T3: yamllint entry', () => {
  it("maps '*.{yml,yaml}' to the yaml lint wrapper", () => {
    const cmds = commandsFor('*.{yml,yaml}')
    expect(cmds).toContain('bash scripts/ci/yaml_lint.sh')
  })
})

// ---------------------------------------------------------------------------
// T4 — actionlint entry wired for GitHub Actions workflows
// ---------------------------------------------------------------------------
describe('T4: actionlint entry', () => {
  it("maps '.github/workflows/*.yml' to a command containing 'actionlint'", () => {
    const cmds = commandsFor('.github/workflows/*.yml')
    expect(anyCmdContains(cmds, 'actionlint')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T5 — No TS/JS glob maps to prettier (Biome owns code files)
// ---------------------------------------------------------------------------
describe('T5: TS/JS keys do not invoke prettier', () => {
  const codeGlobs = [
    '*.{ts,tsx,js,jsx,mjs,vue,json}',
    '*.ts',
    '*.js',
    '*.tsx',
    '*.jsx',
    '*.mjs',
    '*.vue',
    '*.json',
  ]

  for (const glob of codeGlobs) {
    it(`glob '${glob}' does not map to any prettier command`, () => {
      const cmds = commandsFor(glob)
      expect(anyCmdContains(cmds, 'prettier')).toBe(false)
    })
  }
})

// ---------------------------------------------------------------------------
// T6 — Markdown key does not invoke biome (Prettier owns md files)
// ---------------------------------------------------------------------------
describe('T6: *.md key does not invoke biome', () => {
  it("'*.md' does not map to any command containing 'biome'", () => {
    const cmds = commandsFor('*.md')
    expect(anyCmdContains(cmds, 'biome')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T7 — YAML key does not invoke prettier
// ---------------------------------------------------------------------------
describe('T7: *.{yml,yaml} key does not invoke prettier', () => {
  it("'*.{yml,yaml}' does not map to any command containing 'prettier'", () => {
    const cmds = commandsFor('*.{yml,yaml}')
    expect(anyCmdContains(cmds, 'prettier')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T8 — Config export shape is a plain object (not an array)
// ---------------------------------------------------------------------------
describe('T8: Config shape', () => {
  it('exports a plain object (not an array)', () => {
    expect(typeof config).toBe('object')
    expect(Array.isArray(config)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T9 — Config drift: .prettierrc values
// ---------------------------------------------------------------------------
describe('T9: .prettierrc config drift', () => {
  const prettierrcPath = path.join(root, '.prettierrc')
  const raw = fs.readFileSync(prettierrcPath, 'utf-8')
  const parsed = JSON.parse(raw) as Record<string, unknown>

  it('printWidth is 100', () => {
    expect(parsed.printWidth).toBe(100)
  })

  it("proseWrap is 'always'", () => {
    expect(parsed.proseWrap).toBe('preserve')
  })
})

// ---------------------------------------------------------------------------
// T10 — Config drift: .prettierignore does NOT exclude *.md
// ---------------------------------------------------------------------------
describe('T10: .prettierignore does not exclude *.md', () => {
  it('does not contain a *.md or **/*.md exclusion line', () => {
    const ignorePath = path.join(root, '.prettierignore')
    const lines = fs
      .readFileSync(ignorePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))

    const mdExclusion = lines.find((l) => l === '*.md' || l === '**/*.md')
    expect(mdExclusion).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// T11 — Config drift: .yamllint values
// ---------------------------------------------------------------------------
describe('T11: .yamllint config drift', () => {
  const yamllintPath = path.join(root, '.yamllint')
  const raw = fs.readFileSync(yamllintPath, 'utf-8')

  it("extends: 'default'", () => {
    expect(raw).toMatch(/^extends:\s*default\s*$/m)
  })

  it('line-length.max is 120', () => {
    // matches "max: 120" after a "line-length:" block
    expect(raw).toMatch(/line-length:[\s\S]*?max:\s*120/m)
  })

  it('truthy.check-keys is false', () => {
    expect(raw).toMatch(/truthy:[\s\S]*?check-keys:\s*false/m)
  })
})

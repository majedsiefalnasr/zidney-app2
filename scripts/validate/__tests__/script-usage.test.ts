/** @library-module */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extractUsages, USAGE_RE, validateUsages } from '../script-usage'

let tmpDir: string

beforeAll(() => {
  tmpDir = join(tmpdir(), `script-usage-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('USAGE_RE', () => {
  it('matches simple bun run command', () => {
    USAGE_RE.lastIndex = 0
    const m = USAGE_RE.exec('bun run db:migrate')
    expect(m?.[1]).toBe('db:migrate')
  })

  it('matches bun run with a flag before script name', () => {
    USAGE_RE.lastIndex = 0
    const m = USAGE_RE.exec('bun run --silent validate:scripts:naming')
    expect(m?.[1]).toBe('validate:scripts:naming')
  })

  it('does not match plain bun without run', () => {
    USAGE_RE.lastIndex = 0
    const m = USAGE_RE.exec('bun scripts/db/migrate.ts')
    expect(m).toBeNull()
  })
})

describe('extractUsages', () => {
  it('extracts multiple usages from multi-line content', () => {
    const content = [
      'echo "starting"',
      'bun run db:migrate',
      '# then',
      'bun run validate:scripts:naming',
    ].join('\n')
    const usages = extractUsages('test.sh', content)
    expect(usages).toHaveLength(2)
    expect(usages[0]).toEqual({ name: 'db:migrate', line: 2 })
    expect(usages[1]).toEqual({ name: 'validate:scripts:naming', line: 4 })
  })

  it('returns empty array for content with no bun run', () => {
    const usages = extractUsages('test.ts', 'const x = 1')
    expect(usages).toHaveLength(0)
  })

  it('extracts correct line numbers', () => {
    const content = '\n\nbun run arch:guard'
    const usages = extractUsages('test.ts', content)
    expect(usages[0].line).toBe(3)
  })
})

describe('validateUsages', () => {
  it('returns no violations when all references are known', () => {
    const knownScripts = new Set(['db:migrate', 'validate:scripts:naming'])
    const content = 'bun run db:migrate && bun run validate:scripts:naming'
    const filePath = join(tmpDir, 'test-valid.sh')
    writeFileSync(filePath, content, 'utf-8')

    const violations = validateUsages([filePath], knownScripts, tmpDir)
    expect(violations).toHaveLength(0)
  })

  it('returns violations for unknown references', () => {
    const knownScripts = new Set(['db:migrate'])
    const content = 'bun run db:migrate\nbun run nonexistent:script'
    const filePath = join(tmpDir, 'test-broken.sh')
    writeFileSync(filePath, content, 'utf-8')

    const violations = validateUsages([filePath], knownScripts, tmpDir)
    expect(violations).toHaveLength(1)
    expect(violations[0].scriptName).toBe('nonexistent:script')
    expect(violations[0].line).toBe(2)
  })

  it('reports relative file paths in violations', () => {
    const knownScripts = new Set<string>()
    const content = 'bun run something:unknown'
    const filePath = join(tmpDir, 'rel-test.sh')
    writeFileSync(filePath, content, 'utf-8')

    const violations = validateUsages([filePath], knownScripts, tmpDir)
    expect(violations[0].file).not.toContain(tmpDir)
  })

  it('handles unreadable files gracefully', () => {
    const violations = validateUsages([join(tmpDir, 'nonexistent.ts')], new Set(), tmpDir)
    expect(violations).toHaveLength(0)
  })
})

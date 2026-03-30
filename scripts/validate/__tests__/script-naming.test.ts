/** @library-module */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ALLOWED_DOMAINS,
  LIFECYCLE_EXEMPT,
  NAMING_RE,
  parseScriptEntries,
  validateNaming,
} from '../script-naming'
import type { ScriptEntry } from '../types'

let tmpDir: string

beforeAll(() => {
  tmpDir = join(tmpdir(), `script-naming-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writePkg(dir: string, scripts: Record<string, string>): string {
  const pkgPath = join(dir, 'package.json')
  writeFileSync(pkgPath, JSON.stringify({ scripts }), 'utf-8')
  return pkgPath
}

describe('NAMING_RE', () => {
  it('passes valid 2-segment names', () => {
    expect(NAMING_RE.test('db:migrate')).toBe(true)
    expect(NAMING_RE.test('validate:script')).toBe(true)
    expect(NAMING_RE.test('arch:guard')).toBe(true)
  })

  it('passes valid 3-segment names', () => {
    expect(NAMING_RE.test('validate:scripts:naming')).toBe(true)
    expect(NAMING_RE.test('db:status:pool')).toBe(true)
  })

  it('rejects names with unknown domain', () => {
    expect(NAMING_RE.test('foo:bar')).toBe(false)
    expect(NAMING_RE.test('generate:docs')).toBe(false)
  })

  it('rejects names with uppercase letters', () => {
    expect(NAMING_RE.test('DB:migrate')).toBe(false)
    expect(NAMING_RE.test('db:Migrate')).toBe(false)
  })

  it('rejects bare names without colon', () => {
    expect(NAMING_RE.test('build')).toBe(false)
    expect(NAMING_RE.test('vitest')).toBe(false)
  })

  it('rejects 4-segment names', () => {
    expect(NAMING_RE.test('db:a:b:c')).toBe(false)
  })
})

describe('ALLOWED_DOMAINS', () => {
  it('contains exactly the canonical domains', () => {
    expect([...ALLOWED_DOMAINS].sort()).toEqual(
      [
        'ai',
        'arch',
        'ci',
        'db',
        'dev',
        'governance',
        'infra',
        'policy',
        'repo',
        'test',
        'validate',
      ].sort()
    )
  })
})

describe('LIFECYCLE_EXEMPT', () => {
  it('includes standard npm lifecycle hooks', () => {
    expect(LIFECYCLE_EXEMPT.has('prepare')).toBe(true)
    expect(LIFECYCLE_EXEMPT.has('build')).toBe(true)
    expect(LIFECYCLE_EXEMPT.has('test')).toBe(true)
  })
})

describe('parseScriptEntries', () => {
  it('parses scripts from a valid package.json', () => {
    const pkgPath = writePkg(tmpDir, {
      'db:migrate': 'bun scripts/db/migrate.ts',
      'validate:scripts:naming': 'bun scripts/validate/script-naming.ts',
    })
    const entries = parseScriptEntries(pkgPath)
    expect(entries).toHaveLength(2)
    expect(entries[0].name).toBe('db:migrate')
    expect(entries[1].name).toBe('validate:scripts:naming')
  })

  it('returns empty array for invalid JSON', () => {
    const badPath = join(tmpDir, 'bad-package.json')
    writeFileSync(badPath, '{ invalid }', 'utf-8')
    expect(parseScriptEntries(badPath)).toEqual([])
  })

  it('returns empty array for missing file', () => {
    expect(parseScriptEntries(join(tmpDir, 'nonexistent.json'))).toEqual([])
  })
})

describe('validateNaming', () => {
  it('returns no violations for compliant entries', () => {
    const entries: ScriptEntry[] = [
      { name: 'db:migrate', command: 'bun x', packageFile: 'package.json', workspaceName: null },
      {
        name: 'validate:scripts:naming',
        command: 'bun y',
        packageFile: 'package.json',
        workspaceName: null,
      },
    ]
    expect(validateNaming(entries)).toHaveLength(0)
  })

  it('returns violations for non-compliant entries', () => {
    const entries: ScriptEntry[] = [
      { name: 'vitest', command: 'vitest', packageFile: 'package.json', workspaceName: null },
      { name: 'generate-docs', command: 'bun x', packageFile: 'package.json', workspaceName: null },
    ]
    const violations = validateNaming(entries)
    expect(violations).toHaveLength(2)
    expect(violations[0].scriptName).toBe('vitest')
    expect(violations[1].scriptName).toBe('generate-docs')
  })

  it('skips lifecycle-exempt entries', () => {
    const entries: ScriptEntry[] = [
      { name: 'prepare', command: 'husky', packageFile: 'package.json', workspaceName: null },
      { name: 'build', command: 'tsc', packageFile: 'package.json', workspaceName: null },
    ]
    expect(validateNaming(entries)).toHaveLength(0)
  })

  it('includes helpful hints for known vs unknown domain', () => {
    const entries: ScriptEntry[] = [
      { name: 'db_migrate', command: 'bun x', packageFile: 'package.json', workspaceName: null },
      { name: 'unknown-tool', command: 'bun y', packageFile: 'package.json', workspaceName: null },
    ]
    const violations = validateNaming(entries)
    expect(violations).toHaveLength(2)
    const dbViolation = violations.find((v) => v.scriptName === 'db_migrate')
    const unknownViolation = violations.find((v) => v.scriptName === 'unknown-tool')
    expect(dbViolation?.hint).toContain('db')
    expect(unknownViolation?.hint).toContain('Unknown domain')
  })
})

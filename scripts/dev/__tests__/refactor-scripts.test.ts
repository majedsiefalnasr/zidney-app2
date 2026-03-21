import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildFileList,
  parseMigrationMap,
  replaceInFile,
  validateNoRemnants,
  writeReport,
} from '../refactor-scripts'
import type { MigrationEntry } from '../validate/types'

let tmpDir: string

beforeAll(() => {
  tmpDir = join(tmpdir(), `refactor-scripts-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

const SAMPLE_MAP = `
# Script Migration Map

## Type A — Non-Compliant Domain Prefix

| Old Name | Type | Violation | New Name |
| -------- | ---- | --------- | -------- |
| \`check:tsconfig\` | A | \`check\` is not a canonical domain | \`arch:check:tsconfig\` |
| \`hygiene:report\` | A | \`hygiene\` is not a canonical domain | \`repo:hygiene:report\` |

## Type D — Legacy Bare Names

| Old Name | Type | Violation | New Name |
| -------- | ---- | --------- | -------- |
| \`migrate\` | D | bare name, no domain prefix | \`db:migrate\` |
| \`ai-guard\` | D | kebab only, no domain:action | \`ai:guard\` |
`

const SAMPLE_MIGRATIONS: MigrationEntry[] = [
  { oldName: 'check:tsconfig', type: 'A', violation: '', newName: 'arch:check:tsconfig' },
  { oldName: 'hygiene:report', type: 'A', violation: '', newName: 'repo:hygiene:report' },
  { oldName: 'migrate', type: 'D', violation: '', newName: 'db:migrate' },
  { oldName: 'ai-guard', type: 'D', violation: '', newName: 'ai:guard' },
]

// ---------------------------------------------------------------------------

describe('parseMigrationMap', () => {
  it('parses all entries from a valid migration map', () => {
    const entries = parseMigrationMap(SAMPLE_MAP)
    expect(entries).toHaveLength(4)
    expect(entries[0].oldName).toBe('check:tsconfig')
    expect(entries[0].newName).toBe('arch:check:tsconfig')
    expect(entries[0].type).toBe('A')
    expect(entries[2].oldName).toBe('migrate')
    expect(entries[2].newName).toBe('db:migrate')
  })

  it('returns empty array for empty content', () => {
    expect(parseMigrationMap('')).toHaveLength(0)
  })

  it('skips header separator rows', () => {
    const entries = parseMigrationMap(SAMPLE_MAP)
    expect(entries.every((e) => e.oldName !== '---')).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('buildFileList', () => {
  it('returns .ts and .json files', () => {
    writeFileSync(join(tmpDir, 'sample.ts'), 'export {}', 'utf-8')
    writeFileSync(join(tmpDir, 'config.json'), '{}', 'utf-8')
    const files = buildFileList(tmpDir)
    expect(files.some((f) => f.endsWith('.ts'))).toBe(true)
    expect(files.some((f) => f.endsWith('.json'))).toBe(true)
  })

  it('excludes node_modules directories', () => {
    const nmDir = join(tmpDir, 'node_modules')
    mkdirSync(nmDir, { recursive: true })
    writeFileSync(join(nmDir, 'index.ts'), '', 'utf-8')
    const files = buildFileList(tmpDir)
    expect(files.every((f) => !f.includes('node_modules'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('replaceInFile', () => {
  it('replaces matching references', () => {
    const filePath = join(tmpDir, 'replace-test.sh')
    writeFileSync(filePath, 'bun run db:migrate\nbun run ai:guard', 'utf-8')

    const summary = replaceInFile(filePath, SAMPLE_MIGRATIONS, false)
    expect(summary).not.toBeNull()
    expect(summary?.replacements).toHaveLength(2)

    const updated = readFileSync(filePath, 'utf-8')
    expect(updated).toContain('bun run db:migrate')
    expect(updated).toContain('bun run ai:guard')
    expect(updated).not.toContain('bun run db:migrate\n')
  })

  it('returns null when no replacements are needed', () => {
    const filePath = join(tmpDir, 'no-replace.ts')
    writeFileSync(filePath, 'const x = 1', 'utf-8')
    const summary = replaceInFile(filePath, SAMPLE_MIGRATIONS, false)
    expect(summary).toBeNull()
  })

  it('does not write in dry-run mode', () => {
    const filePath = join(tmpDir, 'dry-run.sh')
    const original = 'bun run db:migrate'
    writeFileSync(filePath, original, 'utf-8')

    replaceInFile(filePath, SAMPLE_MIGRATIONS, true)

    const unchanged = readFileSync(filePath, 'utf-8')
    expect(unchanged).toBe(original)
  })
})

// ---------------------------------------------------------------------------

describe('validateNoRemnants', () => {
  it('returns empty array when no old references remain', () => {
    const filePath = join(tmpDir, 'clean.sh')
    writeFileSync(filePath, 'bun run db:migrate && bun run ai:guard', 'utf-8')
    const remnants = validateNoRemnants([filePath], SAMPLE_MIGRATIONS)
    expect(remnants).toHaveLength(0)
  })

  it('detects remaining old references', () => {
    const filePath = join(tmpDir, 'stale.sh')
    writeFileSync(filePath, 'bun run db:migrate', 'utf-8')
    const remnants = validateNoRemnants([filePath], SAMPLE_MIGRATIONS)
    expect(remnants).toHaveLength(1)
    expect(remnants[0].refs).toContain('migrate')
  })
})

// ---------------------------------------------------------------------------

describe('writeReport', () => {
  it('includes zero unresolved when no remnants', () => {
    const output: string[] = []
    const origWrite = process.stdout.write.bind(process.stdout)
    // Intercept stdout
    process.stdout.write = (chunk: string) => {
      output.push(chunk)
      return true
    }

    writeReport([], [], true, 4)

    process.stdout.write = origWrite
    const text = output.join('')
    expect(text).toContain('Unresolved references: 0')
  })
})

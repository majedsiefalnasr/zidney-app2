import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validateMetadataHeaders, validateRegistryFreshness } from '../script-infrastructure'

let tmpDir: string

beforeAll(() => {
  tmpDir = join(tmpdir(), `script-infra-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeScript(name: string, content: string): string {
  const filePath = join(tmpDir, name)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

describe('validateMetadataHeaders', () => {
  it('returns no violations when all 5 tags are present', () => {
    writeScript(
      'valid.ts',
      `/**
 * @script db:migrate
 * @domain db
 * @category runtime
 * @description Runs pending DB migrations.
 * @usage bun run db:migrate
 */
export function run() {}
`
    )
    const violations = validateMetadataHeaders(tmpDir, tmpDir)
    expect(violations).toHaveLength(0)
  })

  it('returns violation when @category is missing', () => {
    writeScript(
      'missing-category.ts',
      `/**
 * @script db:migrate
 * @domain db
 * @description Runs pending DB migrations.
 * @usage bun run db:migrate
 */
export function run() {}
`
    )
    const violations = validateMetadataHeaders(tmpDir, tmpDir)
    const v = violations.find((x) => x.file.includes('missing-category'))
    expect(v?.message).toContain('@category')
  })

  it('skips files with no @script tag at all', () => {
    writeScript(
      'no-script-tag.ts',
      `// utility helper
export function helper() {}
`
    )
    const violations = validateMetadataHeaders(tmpDir, tmpDir)
    const v = violations.find((x) => x.file.includes('no-script-tag'))
    expect(v).toBeUndefined()
  })

  it('returns violation when multiple tags are missing', () => {
    writeScript(
      'sparse.ts',
      `/**
 * @script validate:something
 */
export function run() {}
`
    )
    const violations = validateMetadataHeaders(tmpDir, tmpDir)
    const v = violations.find((x) => x.file.includes('sparse'))
    expect(v).toBeDefined()
    expect(v?.message).toContain('@domain')
    expect(v?.message).toContain('@category')
    expect(v?.message).toContain('@description')
    expect(v?.message).toContain('@usage')
  })
})

describe('validateRegistryFreshness', () => {
  it('returns violation when SCRIPT_REGISTRY.md does not exist', () => {
    const fakePath = join(tmpDir, 'NONEXISTENT_REGISTRY.md')
    const violations = validateRegistryFreshness(tmpDir, fakePath, tmpDir)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('script-registry-missing')
  })

  it('returns violation when registry is stale', () => {
    writeScript(
      'stale-reg-script.ts',
      `/**
 * @script dev:stale-test
 * @domain dev
 * @category dev
 * @description A test script for stale registry detection.
 * @usage bun run dev:stale-test
 */
export function run() {}
`
    )
    const registryPath = join(tmpDir, 'STALE_REGISTRY.md')
    writeFileSync(registryPath, '# Old Registry\n', 'utf-8')

    const violations = validateRegistryFreshness(tmpDir, registryPath, tmpDir)
    expect(violations.length).toBeGreaterThanOrEqual(1)
    const staleViolation = violations.find((v) => v.rule === 'script-registry-stale')
    expect(staleViolation).toBeDefined()
  })
})

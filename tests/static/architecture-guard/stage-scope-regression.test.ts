import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RUNNER_PATH = join(process.cwd(), 'scripts/architecture-guard/runner.ts')

describe('SC-006 stage scope regression', () => {
  it('does not import runtime business modules into unified guard runner', () => {
    const source = readFileSync(RUNNER_PATH, 'utf-8')

    expect(source.includes('apps/api/src')).toBe(false)
    expect(source.includes('apps/worker/src')).toBe(false)
    expect(source.includes('packages/domain-core/src')).toBe(false)
  })
})

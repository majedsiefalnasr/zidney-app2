import { describe, expect, it } from 'vitest'
import { getPassthroughFlags, serializeError } from '../../utils/logger'

describe('scripts/utils/logger', () => {
  it('serializeError formats Error and non-Error values', () => {
    const err = new Error('boom')
    const obj = serializeError(err)
    expect(obj).toHaveProperty('name', 'Error')
    expect(obj).toHaveProperty('message', 'boom')

    const other = serializeError('plain')
    expect(other).toHaveProperty('error')
  })

  it('getPassthroughFlags respects provided args and CI env', () => {
    const args = ['--json', '--pretty']
    const flags = getPassthroughFlags(args)
    expect(flags).toContain('--json')
    expect(flags).toContain('--pretty')

    const ciArgs: string[] = []
    const flags2 = getPassthroughFlags(ciArgs)
    // When CI env not set and args empty, should at least return []
    expect(Array.isArray(flags2)).toBe(true)
  })
})

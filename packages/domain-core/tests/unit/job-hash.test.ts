import { describe, expect, it } from 'vitest'
import {
  computeJobPayloadHash,
  getHashMismatchDetails,
  verifyPayloadHashConsistency,
} from '../../src/job-hash'

describe('job-hash', () => {
  it('computes deterministic hash for same payload regardless of key order', () => {
    const a = { a: 1, b: 2 }
    const b = { b: 2, a: 1 }
    const ha = computeJobPayloadHash(a)
    const hb = computeJobPayloadHash(b)
    expect(typeof ha).toBe('string')
    expect(ha).toHaveLength(64)
    expect(ha).toBe(hb)
  })

  it('verifyPayloadHashConsistency returns true for matching hash', () => {
    const payload = { foo: 'bar' }
    const h = computeJobPayloadHash(payload)
    expect(verifyPayloadHashConsistency(payload, h)).toBe(true)
    expect(verifyPayloadHashConsistency({ foo: 'baz' }, h)).toBe(false)
  })

  it('getHashMismatchDetails returns both hashes and match flag', () => {
    const payload = { x: 1 }
    const expected = computeJobPayloadHash(payload)
    const details = getHashMismatchDetails(payload, expected)
    expect(details.matchesExpected).toBe(true)
    expect(details.expectedHash).toBe(expected)
    expect(typeof details.currentHash).toBe('string')
  })
})

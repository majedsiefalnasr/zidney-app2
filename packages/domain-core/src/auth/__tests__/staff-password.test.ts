import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the argon2 module so the imported `argon2` in `staff-password.ts` uses a configurable mock.
vi.mock('argon2', () => {
  const hash = vi.fn()
  const verify = vi.fn()
  return {
    default: { hash, verify, argon2id: 2 },
    hash,
    verify,
    argon2id: 2,
  }
})

import argon2 from 'argon2'
import { generateStaffDummyHash, hashStaffPassword, verifyStaffPassword } from '../staff-password'

describe('staff-password utilities', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('generateStaffDummyHash returns a constant argon2id string', () => {
    const h = generateStaffDummyHash()
    expect(typeof h).toBe('string')
    expect(h.startsWith('$argon2id$')).toBe(true)
  })

  it('hashStaffPassword delegates to argon2.hash and returns value', async () => {
    ;(argon2.hash as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('$$fake-hash')
    const out = await hashStaffPassword('s3cret!')
    expect(out).toBe('$$fake-hash')
  })

  it('hashStaffPassword rejects empty password', async () => {
    await expect(hashStaffPassword('')).rejects.toThrow()
  })

  it('verifyStaffPassword returns true when argon2.verify resolves true', async () => {
    ;(argon2.verify as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const ok = await verifyStaffPassword('hash', 'pw')
    expect(ok).toBe(true)
  })

  it('verifyStaffPassword returns false when argon2.verify throws', async () => {
    ;(argon2.verify as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
    const ok = await verifyStaffPassword('hash', 'pw')
    expect(ok).toBe(false)
  })
})

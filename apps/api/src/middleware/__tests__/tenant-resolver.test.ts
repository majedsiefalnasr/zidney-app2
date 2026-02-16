import { describe, expect, it } from 'vitest'
import { enforceLicenseStatus } from '../tenant-resolver'

// Mock enforceLicenseStatus
describe('enforceLicenseStatus', () => {
  it('should allow ACTIVE', () => {
    const license = { status: 'ACTIVE' }
    expect(() => enforceLicenseStatus(license)).not.toThrow()
  })

  it('should block SOFT_LOCKED', () => {
    const license = { status: 'SOFT_LOCKED' }
    expect(() => enforceLicenseStatus(license)).toThrow('LICENSE_BLOCKED')
  })
})

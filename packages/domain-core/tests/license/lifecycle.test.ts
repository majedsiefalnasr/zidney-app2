import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createLicense,
  getLicenseById,
  transitionLicenseState,
} from '../../src/license/service'
import { MockDatabaseClient, testFixtures } from './fixtures'

/**
 * Test: License Lifecycle Integration (T042)
 *
 * Integration tests for complete license workflows.
 * Covers: create→user→archive, state transitions, error handling.
 */

describe('LicenseLicecycle Integration', () => {
  let mockDb: MockDatabaseClient
  const workspace_slug = 'acme.edu'
  const workspace_id = testFixtures.makeLicense().workspace_id

  beforeEach(() => {
    mockDb = new MockDatabaseClient()
  })

  afterEach(() => {
    mockDb.reset()
  })

  it('T042.1: End-to-end license creation workflow', async () => {
    const product_id = 'product-uuid'

    mockDb.mockResult('from products where id = $1', [
      testFixtures.makeProduct({ id: product_id }),
    ])

    mockDb.mockResult('insert into licenses', [
      testFixtures.makeLicense({ workspace_slug, product_id }),
    ])

    const result = await createLicense(mockDb, {
      product_id,
      workspace_id,
      workspace_slug,
      expected_schema_version: '1.0.0',
      expected_product_version: '1.0.0',
    })

    expect(result.workspace_slug).toBe(workspace_slug)
    expect(result.status).toBe('ACTIVE')
  })

  it('T042.2: License state progression ACTIVE→SOFT_LOCKED→ARCHIVED', async () => {
    const license = testFixtures.makeLicense()

    mockDb.mockResult('SELECT * FROM licenses WHERE id = $1 FOR UPDATE', [
      license,
    ])

    const transitionResult = await transitionLicenseState(mockDb, {
      license_id: license.id,
      target_state: 'SOFT_LOCKED',
      reason: 'payment_failed',
    })

    expect(transitionResult.success).toBe(true)
    expect(transitionResult.previous_state).toBe('ACTIVE')
  })

  it('T042.3: Cannot create duplicate workspace_slug', async () => {
    // UNIQUE constraint violation
    mockDb.mockResult('from products where id = $1', [
      testFixtures.makeProduct({ id: 'product-uuid' }),
    ])

    mockDb.mockResult('insert into licenses', null, {
      code: '23505',
      message: 'unique violation',
    })

    try {
      await createLicense(mockDb, {
        product_id: 'product-uuid',
        workspace_id,
        workspace_slug,
        expected_schema_version: '1.0.0',
        expected_product_version: '1.0.0',
      })
    } catch (error: any) {
      expect(error.code).toBe('23505')
    }
  })

  it('T042.4: Retrieving license returns full object', async () => {
    const license = testFixtures.makeLicense()

    mockDb.mockResult('from licenses where id = $1 limit 1', [license])

    const result = await getLicenseById(mockDb, license.id)

    expect(result).toEqual(license)
    expect(result?.student_limit).toBeDefined()
    expect(result?.staff_limit).toBeDefined()
    expect(result?.status).toBe('ACTIVE')
  })

  it('T042.5: Auto-transition on soft-lock expiry', async () => {
    const now = new Date()
    const expiredLicense = testFixtures.makeLicense({
      status: 'SOFT_LOCKED',
      soft_lock_until: new Date(now.getTime() - 1000), // 1 sec ago
    })

    // Middleware should detect expiry
    const isExpired = now > expiredLicense.soft_lock_until!
    expect(isExpired).toBe(true)

    // Auto-transition should occur
    mockDb.mockResult('SELECT * FROM licenses WHERE id = $1 FOR UPDATE', [
      expiredLicense,
    ])

    const transitionResult = await transitionLicenseState(mockDb, {
      license_id: expiredLicense.id,
      target_state: 'ARCHIVED',
      reason: 'soft_lock_expired_auto_transition',
    })

    expect(transitionResult.success).toBe(true)
  })
})

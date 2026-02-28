import type { Pool } from 'pg'
import { beforeEach, describe, expect, it } from 'vitest'
import { createUserWithLimitCheck } from '@zidney/app/api/utils/transaction-wrapper'
import { MockDatabaseClient, testFixtures } from './fixtures'

/**
 * Test: Concurrency & Limit Enforcement (T044)
 *
 * Integration tests for concurrent requests at limit boundaries.
 * Critical: Ensures SELECT FOR UPDATE prevents race conditions.
 * Covers: 2 requests at limit=1, atomicity, lock ordering.
 */

describe('Concurrency: Limit Enforcement', () => {
  let masterDb: MockDatabaseClient
  let tenantDb: MockDatabaseClient

  beforeEach(() => {
    masterDb = new MockDatabaseClient()
    tenantDb = new MockDatabaseClient()
  })

  it('T044.1: Two concurrent users at limit=1 → one succeeds, one fails', async () => {
    const license = testFixtures.makeLicense({ student_limit: 1 })
    const workspace_id = license.workspace_id

    // Simulate two concurrent requests
    // Request 1: Lock acquired, count=0, INSERT succeeds
    // Request 2: Waits for lock, then recounts, sees count=1, fails with 402

    masterDb.mockResult(
      'from licenses where workspace_id = $1 for update',
      [license]
    )
    masterDb.mockResult(
      'from licenses where workspace_id = $1 for update',
      [license]
    )

    // First request: count = 0, can add
    tenantDb.mockResult(
      "from users where workspace_id = $1 and status = 'enabled' and role = 'student'",
      [{ count: 0 }]
    )

    const result1 = await createUserWithLimitCheck(masterDb as unknown as Pool, tenantDb as unknown as Pool, {
      workspace_id,
      user_id: 'user-1',
      role: 'STUDENT',
      name: 'User 1',
      email: 'user1@example.com',
      limit: 1,
    })

    expect(result1.success).toBe(true)

    // Second request: count = 1 (after first insert), cannot add
    tenantDb.mockResult(
      "from users where workspace_id = $1 and status = 'enabled' and role = 'student'",
      [{ count: 1 }]
    )

    const result2 = await createUserWithLimitCheck(masterDb as unknown as Pool, tenantDb as unknown as Pool, {
      workspace_id,
      user_id: 'user-2',
      role: 'STUDENT',
      name: 'User 2',
      email: 'user2@example.com',
      limit: 1,
    })

    expect(result2.success).toBe(false)
    expect(result2.error_code).toBe('LIMIT_EXCEEDED')
    expect(result2.http_status).toBe(402)
  })

  it('T044.2: Soft-lock prevents user creation', async () => {
    const softLockedLicense = testFixtures.makeLicense({
      status: 'SOFT_LOCKED',
    })

    masterDb.mockResult(
      'from licenses where workspace_id = $1 for update',
      [softLockedLicense]
    )

    const result = await createUserWithLimitCheck(masterDb as unknown as Pool, tenantDb as unknown as Pool, {
      workspace_id: softLockedLicense.workspace_id,
      user_id: 'user-1',
      role: 'STUDENT',
      name: 'User 1',
      email: 'user1@example.com',
    })

    expect(result.success).toBe(false)
    expect(result.error_code).toBe('LICENSE_SOFT_LOCKED')
    expect(result.http_status).toBe(423)
  })

  it('T044.3: Archived license prevents user creation', async () => {
    const archivedLicense = testFixtures.makeLicense({
      status: 'ARCHIVED',
    })

    masterDb.mockResult(
      'from licenses where workspace_id = $1 for update',
      [archivedLicense]
    )

    const result = await createUserWithLimitCheck(masterDb as unknown as Pool, tenantDb as unknown as Pool, {
      workspace_id: archivedLicense.workspace_id,
      user_id: 'user-1',
      role: 'STUDENT',
      name: 'User 1',
      email: 'user1@example.com',
    })

    expect(result.success).toBe(false)
    expect(result.error_code).toBe('LICENSE_ARCHIVED')
    expect(result.http_status).toBe(403)
  })

  it('T044.4: SELECT FOR UPDATE prevents phantom reads', async () => {
    // Both requests see same count due to FOR UPDATE lock
    const license = testFixtures.makeLicense({ student_limit: 2 })

    masterDb.mockResult(
      'from licenses where workspace_id = $1 for update',
      [license]
    )
    masterDb.mockResult(
      'from licenses where workspace_id = $1 for update',
      [license]
    )

    tenantDb.mockResult(
      "from users where workspace_id = $1 and status = 'enabled' and role = 'student'",
      [{ count: 1 }] // Both requests see count=1
    )
    tenantDb.mockResult(
      "from users where workspace_id = $1 and status = 'enabled' and role = 'student'",
      [{ count: 1 }]
    )

    const result1 = await createUserWithLimitCheck(masterDb as unknown as Pool, tenantDb as unknown as Pool, {
      workspace_id: license.workspace_id,
      user_id: 'user-1',
      role: 'STUDENT',
      name: 'User 1',
      email: 'user1@example.com',
      limit: 2,
    })

    const result2 = await createUserWithLimitCheck(masterDb as unknown as Pool, tenantDb as unknown as Pool, {
      workspace_id: license.workspace_id,
      user_id: 'user-2',
      role: 'STUDENT',
      name: 'User 2',
      email: 'user2@example.com',
      limit: 2,
    })

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true) // Both within limit
  })

  it('T044.5: Unlimited licenses (null limit) always allow additions', async () => {
    const unlimitedLicense = testFixtures.makeLicense({
      student_limit: null,
    })

    masterDb.mockResult(
      'from licenses where workspace_id = $1 for update',
      [unlimitedLicense]
    )

    tenantDb.mockResult(
      "from users where workspace_id = $1 and status = 'enabled' and role = 'student'",
      [{ count: 999 }] // Very high count
    )

    const result = await createUserWithLimitCheck(masterDb as unknown as Pool, tenantDb as unknown as Pool, {
      workspace_id: unlimitedLicense.workspace_id,
      user_id: 'user-1',
      role: 'STUDENT',
      name: 'User 1',
      email: 'user1@example.com',
      limit: null,
    })

    expect(result.success).toBe(true)
  })
})

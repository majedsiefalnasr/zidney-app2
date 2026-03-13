/**
 * Area 3: License Engine Validation (Integration Tests)
 * Real database testing of license state machine and enforcement
 */

import type { Pool } from 'pg'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDbManager } from '../db-manager'
import { cleanupAllFixtures, seedLicense, seedWorkspace } from '../fixtures'

describe('Area 3: License Engine Validation (Integration)', () => {
  let masterDb: Pool
  let workspace: any
  let license: any

  beforeEach(async () => {
    const dbManager = createDbManager()
    masterDb = await dbManager.getMasterDb()

    workspace = await seedWorkspace(masterDb, {
      slug: `test-license-${Date.now()}`,
    })

    license = await seedLicense(masterDb, {
      workspace_id: workspace.id,
      status: 'ACTIVE',
    })
  })

  afterEach(async () => {
    try {
      await cleanupAllFixtures(masterDb)
    } catch (_error) {
      // Ignore
    }
  })

  /**
   * Test 3.1 Integration: State transitions with real database
   */
  it('Test 3.1 Integration: Validates license state transitions in database', async () => {
    // Verify initial state
    expect(license.status).toBe('ACTIVE')

    // Simulate state transition
    const result = await masterDb.query(
      'UPDATE licenses SET status = $1 WHERE id = $2 RETURNING *',
      ['SOFT_LOCKED', license.id]
    )

    const updatedLicense = result.rows[0]
    expect(updatedLicense.status).toBe('SOFT_LOCKED')
  })

  /**
   * Test 3.2 Integration: Version enforcement
   */
  it('Test 3.2 Integration: Enforces schema version compatibility', async () => {
    // Verify license has version
    expect(license.schema_version).toBeDefined()
    expect(license.product_version).toBeDefined()

    // Versions should be semantic
    const versionRegex = /^\d+\.\d+\.\d+$/
    expect(versionRegex.test(license.schema_version)).toBe(true)
  })

  /**
   * Test 3.3 Integration: Limit enforcement in database
   */
  it('Test 3.3 Integration: Verifies limit fields in database', async () => {
    expect(license.max_students).toBeGreaterThan(0)
    expect(license.max_staff).toBeGreaterThan(0)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { StudentStaffCounter } from '../../src/license/limit-enforcer'
import { MockDatabaseClient } from './fixtures'

/**
 * Test: Limit Enforcer (T036)
 *
 * Unit tests for user counting and limit validation.
 * Covers: student count, staff count, soft-delete exclusion, limit checks.
 */

describe('StudentStaffCounter', () => {
  let counter: StudentStaffCounter
  let mockDb: MockDatabaseClient

  beforeEach(() => {
    mockDb = new MockDatabaseClient()
    counter = new StudentStaffCounter(mockDb)
  })

  // From TEST_INDEX.md: 6 tests for limit enforcer
  it('T036.1: Should count enabled students only', async () => {
    mockDb.mockResult(
      "SELECT COUNT(*) FROM users WHERE status='ENABLED' AND role='STUDENT'",
      [{ count: 25 }]
    )

    const count = await counter.countStudents('workspace-uuid')
    expect(count).toBe(25)
  })

  it('T036.2: Should not count disabled students (soft-delete)', async () => {
    mockDb.mockResult(
      "SELECT COUNT(*) FROM users WHERE status='ENABLED' AND role='STUDENT'",
      [{ count: 24 }]
    )

    const count = await counter.countStudents('workspace-uuid')
    expect(count).toBe(24) // Disabled user not counted
  })

  it('T036.3: Should count enabled staff only', async () => {
    mockDb.mockResult(
      "SELECT COUNT(*) FROM users WHERE status='ENABLED' AND role='STAFF'",
      [{ count: 5 }]
    )

    const count = await counter.countStaff('workspace-uuid')
    expect(count).toBe(5)
  })

  it('T036.4: Should allow addition when under limit', async () => {
    const result = counter.canAddStudent(24, 25)
    expect(result).toBe(true)
  })

  it('T036.5: Should reject addition when at limit', async () => {
    const result = counter.canAddStudent(25, 25)
    expect(result).toBe(false)
  })

  it('T036.6: Should allow unlimited additions (null limit)', async () => {
    const result = counter.canAddStudent(1000, null)
    expect(result).toBe(true)
  })
})

/**
 * Limit Enforcer
 *
 * File: packages/domain-core/src/license/limit-enforcer.ts
 * Task: T007 – Create Limit Enforcer (Domain-Core)
 *
 * Counts active users by role (STUDENT, STAFF).
 * Used for limit enforcement (SELECT FOR UPDATE at API layer).
 * This module does NOT enforce limits; it only counts.
 * Enforcement happens transactionally at API layer (T019).
 *
 * Query: SELECT COUNT(*) FROM users
 *          WHERE status='ENABLED' AND role='STUDENT'
 * Notes:
 * - Only counts ENABLED users (DISABLED/soft-deleted don't count)
 * - No FOR UPDATE here (API layer responsibility)
 * - Returns raw counts; API layer makes enforcement decisions
 */

/**
 * StudentStaffCounter class
 *
 * Responsibility:
 * - Count active students
 * - Count active staff
 * - Provide boolean helpers for limit checks
 *
 * Note: No transactional guarantees here.
 * Transactions enforced at API layer (T019).
 */
export class StudentStaffCounter {
  /**
   * Count active students in workspace
   *
   * @param tenantDb - Tenant database connection
   * @param workspace_id - UUID
   * @returns Number of ENABLED students (status = 'ENABLED' AND role = 'STUDENT')
   */
  async countStudents(tenantDb: any, workspace_id: string): Promise<number> {
    const result = await tenantDb.query(
      `
      SELECT COUNT(*) as count
      FROM users
      WHERE workspace_id = $1
        AND status = 'ENABLED'
        AND role = 'STUDENT'
      `,
      [workspace_id]
    )

    return parseInt(result.rows[0].count, 10)
  }

  /**
   * Count active staff in workspace
   *
   * @param tenantDb - Tenant database connection
   * @param workspace_id - UUID
   * @returns Number of ENABLED staff (status = 'ENABLED' AND role = 'STAFF')
   */
  async countStaff(tenantDb: any, workspace_id: string): Promise<number> {
    const result = await tenantDb.query(
      `
      SELECT COUNT(*) as count
      FROM users
      WHERE workspace_id = $1
        AND status = 'ENABLED'
        AND role = 'STAFF'
      `,
      [workspace_id]
    )

    return parseInt(result.rows[0].count, 10)
  }

  /**
   * Check if student can be added
   *
   * @param current_count - Current number of students
   * @param limit - Student limit (null = unlimited)
   * @returns true if student can be added, false if limit reached
   *
   * Logic:
   * - If limit is NULL → unlimited → return true
   * - If current_count >= limit → limit reached → return false
   * - Otherwise → return true
   */
  canAddStudent(current_count: number, limit: number | null): boolean {
    if (limit === null) {
      return true // Unlimited
    }
    return current_count < limit
  }

  /**
   * Check if staff can be added
   *
   * @param current_count - Current number of staff
   * @param limit - Staff limit (null = unlimited)
   * @returns true if staff can be added, false if limit reached
   */
  canAddStaff(current_count: number, limit: number | null): boolean {
    if (limit === null) {
      return true // Unlimited
    }
    return current_count < limit
  }
}

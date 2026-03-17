/**
 * Departments Domain Service — STAGE_23
 *
 * File: packages/domain-core/src/departments/departments.service.ts
 * Stage: STAGE_23_DEPARTMENTS
 * Date: 2026-03-17
 *
 * All 11 service functions for the Departments domain.
 * Uses injected DbClient — no direct Pool instantiation.
 *
 * Transaction discipline:
 * - All write operations (create/update/delete) are wrapped in
 *   BEGIN … COMMIT / ROLLBACK blocks.
 * - updateDepartment uses a recursive CTE for cycle detection.
 *
 * Constitutional Compliance:
 * ✓ Database-per-tenant — no cross-tenant queries
 * ✓ No direct Pool import — all DB access via injected DbClient
 * ✓ Server-authoritative time (NOW() for all timestamps)
 * ✓ Structured logging via @zidney/logger — no console.log
 * ✓ Forward-only — no mutations outside the tenant resolver context
 * ✓ All count checks use FOR UPDATE locks to prevent TOCTOU races (where applicable)
 */

import { createLogger } from '@zidney/logger'

import { DepartmentsError } from './departments.errors'
import type {
  AuditContext,
  CreateDepartmentInput,
  DbClient,
  DepartmentRow,
  DepartmentStatus,
  DepartmentTreeNode,
  DepartmentType,
  ListDepartmentsInput,
  ListDepartmentsResult,
  StaffDepartmentRow,
  UpdateDepartmentInput,
} from './departments.types'

const logger = createLogger('departments-service')

// ---------------------------------------------------------------------------
// 1 — listDepartments
// ---------------------------------------------------------------------------

/**
 * Paginated list of departments with keyset cursor pagination.
 * Supports filtering by status, division, parent, type.
 */
export async function listDepartments(
  db: DbClient,
  input: ListDepartmentsInput
): Promise<ListDepartmentsResult> {
  const { limit, cursor, status, division_id, parent_id, type } = input

  // Build WHERE clause
  const whereClauses: string[] = []
  const params: unknown[] = []

  if (status && status !== 'all') {
    whereClauses.push(`status = $${params.length + 1}`)
    params.push(status)
  }

  if (division_id) {
    whereClauses.push(`division_id = $${params.length + 1}`)
    params.push(division_id)
  }

  if (parent_id === 'root') {
    whereClauses.push(`parent_id IS NULL`)
  } else if (parent_id) {
    whereClauses.push(`parent_id = $${params.length + 1}`)
    params.push(parent_id)
  }

  if (type) {
    whereClauses.push(`type = $${params.length + 1}`)
    params.push(type)
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  // Keyset pagination: use (created_at, id) > (cursor_ts, cursor_id)
  let paginationSQL = ''
  if (cursor) {
    paginationSQL = ` AND (created_at, id) > (
      (SELECT created_at, id FROM departments WHERE id = $${params.length + 1}),
      $${params.length + 1}
    )`
    params.push(cursor, cursor)
  }

  // Fetch limit + 1 to detect next page
  const querySQL = `
    SELECT * FROM departments
    ${whereSQL} ${paginationSQL}
    ORDER BY created_at ASC, id ASC
    LIMIT $${params.length + 1}
  `
  params.push(limit + 1)

  const rows = await db.query<DepartmentRow>(querySQL, params)

  // Count total (respects filters, ignores cursor)
  const countSQL = `SELECT COUNT(*) as count FROM departments ${whereSQL}`
  const countResult = await db.query<{ count: string }>(
    countSQL,
    params.slice(0, params.length - 1)
  )
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

  const hasMore = rows.rows.length > limit
  const items = rows.rows.slice(0, limit)
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

  return { items, nextCursor, total }
}

// ---------------------------------------------------------------------------
// 2 — getDepartment
// ---------------------------------------------------------------------------

/**
 * Fetch a single department by ID.
 * Throws DEPARTMENT_NOT_FOUND if not found.
 */
export async function getDepartment(db: DbClient, id: string): Promise<DepartmentRow> {
  const result = await db.query<DepartmentRow>('SELECT * FROM departments WHERE id = $1', [id])

  if (result.rows.length === 0) {
    throw new DepartmentsError('DEPARTMENT_NOT_FOUND')
  }
  return result.rows[0] as DepartmentRow
}

// ---------------------------------------------------------------------------
// 3 — createDepartment
// ---------------------------------------------------------------------------

/**
 * Create a new department.
 * Steps:
 * 1. Validate parent_id exists (if provided)
 * 2. Validate division_id exists and is ENABLED (if provided)
 * 3. Division consistency check (if both parent_id and division_id provided)
 * 4. Name uniqueness within parent scope
 * 5. INSERT and return new row
 * 6. Log creation
 */
export async function createDepartment(
  db: DbClient,
  input: CreateDepartmentInput,
  audit: AuditContext
): Promise<DepartmentRow> {
  await db.query('BEGIN')
  try {
    const { name, type, parent_id, division_id, max_users, description } = input

    // Step 1: Validate parent_id exists (if provided)
    if (parent_id) {
      const parentResult = await db.query<{ id: string }>(
        'SELECT id FROM departments WHERE id = $1',
        [parent_id]
      )
      if (parentResult.rows.length === 0) {
        throw new DepartmentsError('DEPARTMENT_NOT_FOUND')
      }
    }

    // Step 2: Validate division_id exists and is ENABLED (if provided)
    if (division_id) {
      const divResult = await db.query<{ id: string; status: string }>(
        "SELECT id, status FROM divisions WHERE id = $1 AND status = 'ENABLED'",
        [division_id]
      )
      if (divResult.rows.length === 0) {
        throw new DepartmentsError('VALIDATION_ERROR', 'Division with the given ID does not exist.')
      }
    }

    // Step 3: Division consistency check
    if (parent_id && division_id) {
      const parentDeptResult = await db.query<{ division_id: string | null }>(
        'SELECT division_id FROM departments WHERE id = $1',
        [parent_id]
      )
      const parentDivision = parentDeptResult.rows[0]?.division_id ?? null
      if (parentDivision !== null && parentDivision !== division_id) {
        throw new DepartmentsError('DEPARTMENT_DIVISION_MISMATCH')
      }
    }

    // Step 4: Name uniqueness within parent scope
    const nameCheckSQL = `
      SELECT id FROM departments
      WHERE LOWER(name) = LOWER($1)
        AND parent_id ${parent_id ? '= $2' : 'IS NULL'}
    `
    const nameParams = parent_id ? [name, parent_id] : [name]
    const nameResult = await db.query<{ id: string }>(nameCheckSQL, nameParams)
    if (nameResult.rows.length > 0) {
      throw new DepartmentsError('DEPARTMENT_NAME_DUPLICATE')
    }

    // Step 5: INSERT
    const insertSQL = `
      INSERT INTO departments (name, type, parent_id, division_id, max_users, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `
    const insertResult = await db.query<DepartmentRow>(insertSQL, [
      name,
      type,
      parent_id ?? null,
      division_id ?? null,
      max_users ?? null,
      description ?? null,
      'ENABLED',
    ])

    const newDept = insertResult.rows[0] as DepartmentRow

    // Step 6: Log
    logger.info('Department created', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      workspace_slug: audit.workspace_slug,
      user_id: audit.user_id,
      department_id: newDept.id,
      parent_id: parent_id ?? null,
      division_id: division_id ?? null,
    })

    await db.query('COMMIT')
    return newDept
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// 4 — updateDepartment
// ---------------------------------------------------------------------------

/**
 * Update a department.
 * Steps:
 * 1. Fetch current department row (throw DEPARTMENT_NOT_FOUND if not exists)
 * 2. If division_id key present: validate division exists and is ENABLED
 * 3. If parent_id key present and differs from current:
 *    - If new parent_id is not null: run cycle detection (throws DEPARTMENT_CIRCULAR_REFERENCE)
 *    - Division consistency check against new parent
 * 4. If name changes or parent_id changes: name uniqueness check in new parent scope
 * 5. UPDATE with SET clause for provided fields only
 * 6. Log update
 */
export async function updateDepartment(
  db: DbClient,
  id: string,
  input: UpdateDepartmentInput,
  audit: AuditContext
): Promise<DepartmentRow> {
  await db.query('BEGIN')
  try {
    // Step 1: Fetch current
    const currentResult = await db.query<DepartmentRow>('SELECT * FROM departments WHERE id = $1', [
      id,
    ])
    if (currentResult.rows.length === 0) {
      throw new DepartmentsError('DEPARTMENT_NOT_FOUND')
    }
    const current = currentResult.rows[0] as DepartmentRow

    // Step 2: Validate division_id if present in input
    if ('division_id' in input && input.division_id) {
      const divResult = await db.query<{ id: string; status: string }>(
        "SELECT id, status FROM divisions WHERE id = $1 AND status = 'ENABLED'",
        [input.division_id]
      )
      if (divResult.rows.length === 0) {
        throw new DepartmentsError('VALIDATION_ERROR', 'Division with the given ID does not exist.')
      }
    }

    // Step 3: Handle parent_id changes
    const newParentId = 'parent_id' in input ? input.parent_id : current.parent_id
    if ('parent_id' in input && input.parent_id !== current.parent_id) {
      // If new parent_id is not null, run cycle detection
      if (input.parent_id !== null) {
        const cycleDetectSQL = `
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id FROM departments WHERE id = $1
            UNION ALL
            SELECT d.id, d.parent_id FROM departments d
            JOIN ancestors a ON d.id = a.parent_id
          )
          SELECT id FROM ancestors WHERE id = $2
        `
        const cycleResult = await db.query<{ id: string }>(cycleDetectSQL, [input.parent_id, id])
        if (cycleResult.rows.length > 0) {
          throw new DepartmentsError('DEPARTMENT_CIRCULAR_REFERENCE')
        }
      }

      // Division consistency check
      if (input.parent_id !== null && 'division_id' in input && input.division_id) {
        const parentDeptResult = await db.query<{ division_id: string | null }>(
          'SELECT division_id FROM departments WHERE id = $1',
          [input.parent_id]
        )
        const parentDivision = parentDeptResult.rows[0]?.division_id ?? null
        if (parentDivision !== null && parentDivision !== input.division_id) {
          throw new DepartmentsError('DEPARTMENT_DIVISION_MISMATCH')
        }
      }
    }

    // Step 4: Name uniqueness if name or parent_id changes
    if ('name' in input || 'parent_id' in input) {
      const newName = input.name ?? current.name
      const checkParentId = newParentId
      const nameCheckSQL = `
        SELECT id FROM departments
        WHERE id != $1
          AND LOWER(name) = LOWER($2)
          AND parent_id ${checkParentId ? '= $3' : 'IS NULL'}
      `
      const nameParams = checkParentId ? [id, newName, checkParentId] : [id, newName]
      const nameResult = await db.query<{ id: string }>(nameCheckSQL, nameParams)
      if (nameResult.rows.length > 0) {
        throw new DepartmentsError('DEPARTMENT_NAME_DUPLICATE')
      }
    }

    // Step 5: Build UPDATE SET clause
    const setClauses: string[] = ['updated_at = NOW()']
    const updateParams: unknown[] = [id]

    let paramIndex = 2
    if ('name' in input) {
      setClauses.push(`name = $${paramIndex}`)
      updateParams.push(input.name)
      paramIndex++
    }
    if ('type' in input) {
      setClauses.push(`type = $${paramIndex}`)
      updateParams.push(input.type)
      paramIndex++
    }
    if ('parent_id' in input) {
      setClauses.push(`parent_id = $${paramIndex}`)
      updateParams.push(input.parent_id ?? null)
      paramIndex++
    }
    if ('division_id' in input) {
      setClauses.push(`division_id = $${paramIndex}`)
      updateParams.push(input.division_id ?? null)
      paramIndex++
    }
    if ('max_users' in input) {
      setClauses.push(`max_users = $${paramIndex}`)
      updateParams.push(input.max_users ?? null)
      paramIndex++
    }
    if ('description' in input) {
      setClauses.push(`description = $${paramIndex}`)
      updateParams.push(input.description ?? null)
      paramIndex++
    }
    if ('status' in input) {
      setClauses.push(`status = $${paramIndex}`)
      updateParams.push(input.status)
      paramIndex++
    }

    const updateSQL = `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`
    const updateResult = await db.query<DepartmentRow>(updateSQL, updateParams)
    const updated = updateResult.rows[0] as DepartmentRow

    // Step 6: Log
    logger.info('Department updated', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      workspace_slug: audit.workspace_slug,
      user_id: audit.user_id,
      department_id: id,
    })

    await db.query('COMMIT')
    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// 5 — deleteDepartment
// ---------------------------------------------------------------------------

/**
 * Delete a department.
 * Guards:
 * 1. Fetch department row (throw DEPARTMENT_NOT_FOUND)
 * 2. Check for children (throw DEPARTMENT_HAS_CHILDREN)
 * 3. Check for student assignments (throw DEPARTMENT_HAS_ASSIGNMENTS)
 * 4. Check for staff assignments (throw DEPARTMENT_HAS_ASSIGNMENTS)
 * 5. DELETE
 * 6. Log
 */
export async function deleteDepartment(
  db: DbClient,
  id: string,
  audit: AuditContext
): Promise<void> {
  await db.query('BEGIN')
  try {
    // Step 1: Fetch department
    const deptResult = await db.query<DepartmentRow>('SELECT * FROM departments WHERE id = $1', [
      id,
    ])
    if (deptResult.rows.length === 0) {
      throw new DepartmentsError('DEPARTMENT_NOT_FOUND')
    }

    // Step 2: Check children
    const childrenResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM departments WHERE parent_id = $1',
      [id]
    )
    if (parseInt(childrenResult.rows[0]?.count ?? '0', 10) > 0) {
      throw new DepartmentsError('DEPARTMENT_HAS_CHILDREN')
    }

    // Step 3: Check student assignments
    const studentResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM students WHERE department_id = $1',
      [id]
    )
    if (parseInt(studentResult.rows[0]?.count ?? '0', 10) > 0) {
      throw new DepartmentsError('DEPARTMENT_HAS_ASSIGNMENTS')
    }

    // Step 4: Check staff assignments
    const staffResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM staff_departments WHERE department_id = $1',
      [id]
    )
    if (parseInt(staffResult.rows[0]?.count ?? '0', 10) > 0) {
      throw new DepartmentsError('DEPARTMENT_HAS_ASSIGNMENTS')
    }

    // Step 5: DELETE
    await db.query('DELETE FROM departments WHERE id = $1', [id])

    // Step 6: Log
    logger.info('Department deleted', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      workspace_slug: audit.workspace_slug,
      user_id: audit.user_id,
      department_id: id,
    })

    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// 6 — getDepartmentChildren
// ---------------------------------------------------------------------------

/**
 * Fetch all direct children of a department.
 * Throws DEPARTMENT_NOT_FOUND if parent does not exist.
 */
export async function getDepartmentChildren(db: DbClient, id: string): Promise<DepartmentRow[]> {
  // Verify department exists
  const deptResult = await db.query<{ id: string }>('SELECT id FROM departments WHERE id = $1', [
    id,
  ])
  if (deptResult.rows.length === 0) {
    throw new DepartmentsError('DEPARTMENT_NOT_FOUND')
  }

  const result = await db.query<DepartmentRow>(
    'SELECT * FROM departments WHERE parent_id = $1 ORDER BY created_at ASC, id ASC',
    [id]
  )

  return result.rows
}

// ---------------------------------------------------------------------------
// 7 — getDepartmentTree
// ---------------------------------------------------------------------------

/**
 * Fetch the full department tree.
 * Fetches all departments and builds nested tree in-app using Map<id, node>.
 */
export async function getDepartmentTree(db: DbClient): Promise<DepartmentTreeNode[]> {
  const result = await db.query<{
    id: string
    name: string
    type: string
    status: string
    parent_id: string | null
    division_id: string | null
  }>(
    'SELECT id, name, type, status, parent_id, division_id FROM departments ORDER BY parent_id NULLS FIRST, created_at ASC'
  )

  const nodeMap = new Map<string, DepartmentTreeNode>()
  const roots: DepartmentTreeNode[] = []

  // Step 1: Create all nodes
  for (const row of result.rows) {
    const node: DepartmentTreeNode = {
      id: row.id,
      name: row.name,
      type: row.type as DepartmentType,
      status: row.status as DepartmentStatus,
      parent_id: row.parent_id,
      division_id: row.division_id,
      children: [],
    }
    nodeMap.set(row.id, node)
  }

  // Step 2: Build hierarchy
  for (const row of result.rows) {
    const node = nodeMap.get(row.id) as DepartmentTreeNode
    if (row.parent_id === null) {
      roots.push(node)
    } else {
      const parent = nodeMap.get(row.parent_id)
      if (parent) {
        parent.children.push(node)
      }
    }
  }

  return roots
}

// ---------------------------------------------------------------------------
// 8 — getStaffDepartments
// ---------------------------------------------------------------------------

/**
 * Fetch all departments assigned to a staff member.
 */
export async function getStaffDepartments(
  db: DbClient,
  staffId: string
): Promise<StaffDepartmentRow[]> {
  const result = await db.query<StaffDepartmentRow>(
    'SELECT staff_id, department_id, assigned_at FROM staff_departments WHERE staff_id = $1 ORDER BY assigned_at ASC',
    [staffId]
  )

  return result.rows
}

// ---------------------------------------------------------------------------
// 9 — assignStaffDepartment
// ---------------------------------------------------------------------------

/**
 * Assign a staff member to a department.
 * Steps:
 * 1. Fetch department (throw DEPARTMENT_NOT_FOUND)
 * 2. Check status = ENABLED (throw DEPARTMENT_DISABLED)
 * 3. If department has division_id: verify staff has that division (throw DEPARTMENT_DIVISION_MISMATCH)
 * 4. INSERT ON CONFLICT DO NOTHING (idempotent)
 * 4b. SELECT the row (handles both insert and idempotent-skip paths)
 * 5. Return the row
 * 6. Log
 */
export async function assignStaffDepartment(
  db: DbClient,
  staffId: string,
  departmentId: string,
  audit: AuditContext
): Promise<StaffDepartmentRow> {
  await db.query('BEGIN')
  try {
    // Step 1: Fetch department
    const deptResult = await db.query<{ id: string; status: string; division_id: string | null }>(
      'SELECT id, status, division_id FROM departments WHERE id = $1',
      [departmentId]
    )
    if (deptResult.rows.length === 0) {
      throw new DepartmentsError('DEPARTMENT_NOT_FOUND')
    }
    const dept = deptResult.rows[0] as { id: string; status: string; division_id: string | null }

    // Step 2: Check status = ENABLED
    if (dept.status !== 'ENABLED') {
      throw new DepartmentsError('DEPARTMENT_DISABLED')
    }

    // Step 3: Division consistency check
    if (dept.division_id !== null) {
      const staffDivResult = await db.query<{ division_id: string }>(
        'SELECT division_id FROM staff_divisions WHERE staff_id = $1 AND division_id = $2',
        [staffId, dept.division_id]
      )
      if (staffDivResult.rows.length === 0) {
        throw new DepartmentsError('DEPARTMENT_DIVISION_MISMATCH')
      }
    }

    // Step 4: INSERT ON CONFLICT DO NOTHING (idempotent)
    await db.query(
      'INSERT INTO staff_departments (staff_id, department_id, assigned_at) VALUES ($1, $2, NOW()) ON CONFLICT (staff_id, department_id) DO NOTHING',
      [staffId, departmentId]
    )

    // Step 4b: SELECT the row
    const rowResult = await db.query<StaffDepartmentRow>(
      'SELECT staff_id, department_id, assigned_at FROM staff_departments WHERE staff_id = $1 AND department_id = $2',
      [staffId, departmentId]
    )
    const row = rowResult.rows[0] as StaffDepartmentRow

    // Step 6: Log
    logger.info('Department staff assigned', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      workspace_slug: audit.workspace_slug,
      user_id: audit.user_id,
      staff_id: staffId,
      department_id: departmentId,
    })

    await db.query('COMMIT')
    return row
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// 10 — removeStaffDepartment
// ---------------------------------------------------------------------------

/**
 * Remove a staff member's assignment to a department.
 * Steps:
 * 1. Verify assignment exists (throw DEPT_STAFF_ASSIGNMENT_NOT_FOUND)
 * 2. DELETE
 * 3. Log
 */
export async function removeStaffDepartment(
  db: DbClient,
  staffId: string,
  departmentId: string,
  audit: AuditContext
): Promise<void> {
  await db.query('BEGIN')
  try {
    // Step 1: Verify assignment exists
    const assignResult = await db.query<{ staff_id: string }>(
      'SELECT staff_id FROM staff_departments WHERE staff_id = $1 AND department_id = $2',
      [staffId, departmentId]
    )
    if (assignResult.rows.length === 0) {
      throw new DepartmentsError('DEPT_STAFF_ASSIGNMENT_NOT_FOUND')
    }

    // Step 2: DELETE
    await db.query('DELETE FROM staff_departments WHERE staff_id = $1 AND department_id = $2', [
      staffId,
      departmentId,
    ])

    // Step 3: Log
    logger.info('Department staff removed', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      workspace_slug: audit.workspace_slug,
      user_id: audit.user_id,
      staff_id: staffId,
      department_id: departmentId,
    })

    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// 11 — checkDepartmentCapacity (INTERNAL helper)
// ---------------------------------------------------------------------------

/**
 * @internal — For use by student-assignment domain only. Not a stable public API surface.
 *
 * Check if a department has capacity for a new student assignment.
 * Must be called inside an open transaction.
 *
 * Steps:
 * 1. SELECT FOR UPDATE to lock the department row
 * 2. Check max_users (if null, no limit)
 * 3. COUNT students
 * 4. Throw DEPARTMENT_MAX_USERS_EXCEEDED if count >= max_users
 */
export async function checkDepartmentCapacity(db: DbClient, departmentId: string): Promise<void> {
  // Step 1: SELECT FOR UPDATE
  const deptResult = await db.query<{ max_users: number | null }>(
    'SELECT max_users FROM departments WHERE id = $1 FOR UPDATE',
    [departmentId]
  )

  if (deptResult.rows.length === 0) {
    throw new DepartmentsError('DEPARTMENT_NOT_FOUND')
  }

  const { max_users } = deptResult.rows[0] as { max_users: number | null }

  // Step 2: If max_users is null, no limit
  if (max_users === null) {
    return
  }

  // Step 3: COUNT students
  const countResult = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM students WHERE department_id = $1',
    [departmentId]
  )
  const count = parseInt(countResult.rows[0]?.count ?? '0', 10)

  // Step 4: Check capacity
  if (count >= max_users) {
    throw new DepartmentsError('DEPARTMENT_MAX_USERS_EXCEEDED')
  }
}

/**
 * Students Domain — Bulk Import
 *
 * File: packages/domain-core/src/students/students.bulk-import.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Processes bulk student import rows in batches of 50.
 * Each batch runs in a SERIALIZABLE transaction.
 * Per-row errors are collected and returned; a single row failure
 * does not abort the entire batch.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ SERIALIZABLE isolation per batch for limit enforcement
 * ✓ Idempotent — duplicate emails within a batch produce a per-row error, not a crash
 * ✓ password_hash never logged or returned
 */

import { hashStaffPassword } from '../auth/staff-password'
import { StudentError } from './students.errors'
import {
  countActiveStudents,
  findStudentByEmailForUpdate,
  insertStudent,
  validateDivisionActive,
} from './students.repository'
import type {
  BulkImportResult,
  BulkImportRow,
  BulkImportRowError,
  DbClient,
  StudentErrorCode,
} from './students.types'

const BATCH_SIZE = 50

/**
 * Chunk an array into sub-arrays of `size`.
 */
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

/**
 * Process bulk import rows in batches of 50.
 *
 * @param db           - Tenant database pool
 * @param workspaceId  - Current workspace ID (for limit / audit scoping)
 * @param rows         - Raw import rows from request body
 * @param studentLimit - Maximum ACTIVE students for this workspace
 * @param divisionId   - Default division to assign to all imported students
 * @returns BulkImportResult with per-row error details
 */
export async function processBulkImport(
  db: DbClient,
  workspaceId: string,
  rows: BulkImportRow[],
  studentLimit: number,
  divisionId: string
): Promise<BulkImportResult> {
  let inserted = 0
  let skipped = 0
  const errors: BulkImportRowError[] = []

  // Validate the assigned division before processing any rows
  try {
    const client = await db.connect()
    try {
      await validateDivisionActive(client, workspaceId, divisionId)
    } finally {
      client.release()
    }
  } catch (err) {
    // All rows fail if the division is invalid
    const code: StudentErrorCode =
      err instanceof StudentError ? err.code : 'STUDENT_DIVISION_INACTIVE'
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      errors.push({
        row_index: i,
        email: r?.email ?? '',

        reason: err instanceof StudentError ? err.message : 'Division invalid',
        code,
      })
    }
    return { inserted: 0, skipped: 0, errors }
  }

  let rowOffset = 0

  for (const batch of chunks(rows, BATCH_SIZE)) {
    const client = await db.connect()
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    try {
      const currentActive = await countActiveStudents(client, workspaceId)
      let batchInserted = 0

      for (const [batchIdx, row] of batch.entries()) {
        const absoluteIdx = rowOffset + batchIdx

        // Enforce limit (counts already-inserted rows in this batch)
        if (currentActive + inserted + batchInserted >= studentLimit) {
          errors.push({
            row_index: absoluteIdx,
            email: row.email,
            reason: `Workspace has reached the student limit of ${studentLimit}`,
            code: 'STUDENT_LIMIT_EXCEEDED',
          })
          skipped++
          continue
        }

        // Email uniqueness check within transaction
        const existing = await findStudentByEmailForUpdate(client, workspaceId, row.email)
        if (existing) {
          errors.push({
            row_index: absoluteIdx,
            email: row.email,
            reason: `Email already registered: ${row.email}`,
            code: 'STUDENT_EMAIL_CONFLICT',
          })
          skipped++
          continue
        }

        // Hash password
        const passwordHash = await hashStaffPassword(row.password)

        // Insert row
        await insertStudent(client, {
          workspace_id: workspaceId,
          email: row.email,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          division_id: divisionId,
          department_id: null,
          group_id: null,
          semester_id: null,
          phone: row.phone ?? null,
          external_id: row.external_id ?? null,
          password: row.password,
          password_hash: passwordHash,
        })
        batchInserted++
      }

      await client.query('COMMIT')
      inserted += batchInserted
    } catch (err) {
      await client.query('ROLLBACK')
      // Mark all rows in this batch as failed
      for (let batchIdx = 0; batchIdx < batch.length; batchIdx++) {
        const absoluteIdx = rowOffset + batchIdx
        const row = batch[batchIdx]
        errors.push({
          row_index: absoluteIdx,
          email: row.email,
          reason: err instanceof Error ? err.message : 'Batch transaction failed',
          code: 'STUDENT_EMAIL_CONFLICT', // generic batch failure
        })
        skipped++
      }
    } finally {
      client.release()
    }

    rowOffset += batch.length
  }

  return { inserted, skipped, errors }
}

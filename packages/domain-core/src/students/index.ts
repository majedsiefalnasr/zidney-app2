/**
 * Students Domain — Public Barrel
 *
 * File: packages/domain-core/src/students/index.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 */

export type { StudentErrorCode } from './students.errors'
export { STUDENT_ERROR_HTTP, StudentError } from './students.errors'
export {
  bulkImportStudents,
  createStudent,
  deleteStudent,
  disableStudent,
  enableStudent,
  getStudentById,
  listStudents,
  toStudentRecord,
  updateStudent,
  updateStudentSubscriptionStatus,
} from './students.service'
export type {
  AuditContext,
  BulkImportResult,
  BulkImportRow,
  BulkImportRowError,
  CreateStudentInput,
  StudentListQuery,
  StudentListResult,
  StudentRecord,
  StudentRow,
  StudentStatus,
  SubscriptionStatus,
  UpdateStudentInput,
  UpdateSubscriptionInput,
} from './students.types'

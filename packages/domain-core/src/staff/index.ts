/**
 * Staff Domain — Public Barrel
 *
 * File: packages/domain-core/src/staff/index.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 */

export type { StaffErrorCode } from './staff.errors'
export { STAFF_ERROR_HTTP, StaffError } from './staff.errors'
export {
  createStaff,
  deleteStaff,
  disableStaff,
  enableStaff,
  getStaffById,
  listStaff,
  updateStaff,
} from './staff.service'
export type {
  AuditContext,
  CreateStaffInput,
  StaffListQuery,
  StaffListResult,
  StaffRecord,
  StaffStatus,
  UpdateStaffInput,
} from './staff.types'

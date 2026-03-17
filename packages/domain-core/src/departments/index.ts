/**
 * Departments Domain — Public Barrel
 *
 * Re-exports all public symbols from the departments subdomain.
 * Consumed via:
 *   - Root barrel: `export * from './departments'` in domain-core/src/index.ts
 *   - Subpath:     `"./departments"` entry in domain-core/package.json exports
 */

export * from './departments.errors'
export * from './departments.service'
export {
  type AuditContext,
  type CreateDepartmentInput,
  type DbClient,
  type DepartmentRow,
  DepartmentStatus,
  type DepartmentTreeNode,
  DepartmentType,
  type ListDepartmentsInput,
  type ListDepartmentsResult,
  type StaffDepartmentRow,
  type UpdateDepartmentInput,
} from './departments.types'

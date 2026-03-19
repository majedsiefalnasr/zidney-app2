/**
 * Groups Domain — Public Barrel
 *
 * Re-exports all public symbols from the groups subdomain.
 * Consumed via:
 *   - Root barrel: `export * from './groups'` in domain-core/src/index.ts
 *   - Subpath:     `"./groups"` entry in domain-core/package.json exports
 */

export * from './groups.errors'
export * from './groups.service'
export {
  type AuditContext,
  type CreateGroupInput,
  type DbClient,
  type GroupRow,
  GroupStatus,
  type ListGroupsInput,
  type ListGroupsResult,
  type StaffGroupRow,
  type StudentGroupResult,
  type UpdateGroupInput,
} from './groups.types'

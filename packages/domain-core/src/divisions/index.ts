/**
 * Divisions Domain — Public Barrel
 *
 * Re-exports all public symbols from the divisions subdomain.
 * Consumed via:
 *   - Root barrel: `export * from './divisions'` in domain-core/src/index.ts
 *   - Subpath:     `"./divisions"` entry in domain-core/package.json exports
 *
 * Note: DbClient is an internal structural type for service injection only.
 * It is not re-exported to avoid naming conflicts.
 */

export * from './divisions.errors'
export * from './divisions.service'
export {
  type AuditContext,
  type CreateDivisionInput,
  type DisableDivisionsResult,
  type DivisionRow,
  DivisionStatus,
  type ListDivisionsInput,
  type ListDivisionsResult,
  type StaffDivisionRow,
  type UpdateDivisionInput,
  type UpdateDivisionStatusInput,
} from './divisions.types'

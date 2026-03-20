/**
 * Tenant Database Schemas — Public Barrel
 *
 * File: apps/api/src/db/tenant/schemas/index.ts
 *
 * Re-exports all Drizzle ORM schema definitions for the tenant database.
 * Consumed by migrations, service layer, and route handlers.
 */

export * from './backoffice-role-module-permissions.schema'
export * from './backoffice-roles.schema'
export * from './backoffice-staff-users.schema'
export * from './departments.schema'
export * from './divisions.schema'
export * from './groups.schema'
export * from './rbac-audit-logs.schema'
export * from './staff-departments.schema'
export * from './staff-divisions.schema'
export * from './staff-groups.schema'
export * from './staff-teams.schema'
export * from './students.schema'
export * from './team-types.schema'
export * from './teams.schema'
export * from './translation-audit-logs.schema'
export * from './translations.schema'
export * from './workspace-settings.schema'

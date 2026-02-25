/**
 * Permission Domain Enum
 *
 * File: packages/types/src/permissions.ts
 * Task: T027
 * Phase: 4 - Role & Permission Management
 *
 * Centralized definition of all permission domains for MMC.
 * Used by permission enforcement middleware and role permission matrix.
 *
 * Domains:
 * 1. ORGANIZATION_SETTINGS - Organization name, branding, contact info
 * 2. PRODUCT_MANAGEMENT - Create/edit/delete products, config exams
 * 3. LICENSE_MANAGEMENT - View license status, manage activations, renew
 * 4. CLIENT_MANAGEMENT - Create/manage institutional clients
 * 5. AFFILIATE_MANAGEMENT - Manage affiliate partners, revenue share
 * 6. MEMBERS_MANAGEMENT - Create/edit/disable MMC members
 * 7. REPORTING - Access audit logs, analytics, compliance reports
 */

/**
 * Permission Domain Enum
 *
 * All 7 domains for MMC RBAC system
 */
export const PermissionDomainValues = [
  'ORGANIZATION_SETTINGS',
  'PRODUCT_MANAGEMENT',
  'LICENSE_MANAGEMENT',
  'CLIENT_MANAGEMENT',
  'AFFILIATE_MANAGEMENT',
  'MEMBERS_MANAGEMENT',
  'REPORTING',
] as const

export type PermissionDomain = (typeof PermissionDomainValues)[number]

/**
 * Check if string is valid permission domain
 */
export function isValidPermissionDomain(
  value: unknown
): value is PermissionDomain {
  return (
    typeof value === 'string' &&
    PermissionDomainValues.includes(value as PermissionDomain)
  )
}

/**
 * Permission domain descriptions (for UI/documentation)
 */
export const PermissionDomainDescriptions: Record<PermissionDomain, string> = {
  ORGANIZATION_SETTINGS: 'Organization name, branding, contact information',
  PRODUCT_MANAGEMENT: 'Create/edit/delete products and exam configurations',
  LICENSE_MANAGEMENT: 'View license status, manage activations, renewals',
  CLIENT_MANAGEMENT: 'Create and manage institutional clients',
  AFFILIATE_MANAGEMENT: 'Manage affiliate partners and revenue sharing',
  MEMBERS_MANAGEMENT: 'Create/edit/disable internal MMC members',
  REPORTING: 'Access audit logs, analytics, and compliance reporting',
}

/**
 * Permission actions for all domains
 */
export const PermissionActionValues = [
  'view',
  'create',
  'edit',
  'delete',
] as const

export type PermissionAction = (typeof PermissionActionValues)[number]

/**
 * Check if string is valid permission action
 */
export function isValidPermissionAction(
  value: unknown
): value is PermissionAction {
  return (
    typeof value === 'string' &&
    PermissionActionValues.includes(value as PermissionAction)
  )
}

/**
 * Permission action descriptions
 */
export const PermissionActionDescriptions: Record<PermissionAction, string> = {
  view: 'View/read access',
  create: 'Create new entities',
  edit: 'Modify existing entities',
  delete: 'Delete/destroy entities',
}

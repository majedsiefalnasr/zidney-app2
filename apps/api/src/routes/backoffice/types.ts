/**
 * Backoffice Route Type Definitions — STAGE_17
 *
 * File: apps/api/src/routes/backoffice/types.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Date: 2026-02-28
 *
 * Hono Variables type map for all Backoffice routes and middleware.
 * Imported by context.ts, ws.ts, and all backoffice middleware so that
 * every `c.get()` call is fully typed with no `unknown` inferences.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure type definitions only
 * ✓ All Backoffice Hono instances typed: new Hono<BackofficeEnv>()
 * ✓ ADR-0001: tenant context type reflects database-per-tenant model
 */

import type { LicenseStatus, Module } from '@zidney/types'
import type { Redis } from 'ioredis'
import type { Pool } from 'pg'

/**
 * Resolved tenant context set by the tenant resolver middleware.
 * Contains the tenant-scoped DB pool and Redis client.
 */
export interface TenantContext {
  /** Tenant UUID */
  id: string
  /** Workspace slug (subdomain / path segment) */
  slug: string
  /** schema_version from the tenant's schema_versions table */
  schema_version: number
  /** Tenant-scoped PostgreSQL connection pool */
  pool: Pool
  /** Optional tenant-scoped Redis client */
  redis?: Redis
}

/**
 * Staff user context as stored in Hono Variables.
 * Minimal shape set by Authentication middleware after JWT validation.
 */
export type StaffUserContext = {
  user_id: string
  role: string
}

/**
 * Full Hono Variables map for Backoffice routes.
 * Every field is set by a specific middleware before the route handler executes.
 */
export type BackofficeVariables = {
  /** Set by correlation-id middleware */
  correlationId: string
  /** Set by tenant resolver middleware */
  tenant: TenantContext
  /** Set by authentication middleware */
  staff_user: StaffUserContext
  /** Set by license enforcement middleware */
  license_status: LicenseStatus
  /** Set by license enforcement middleware */
  enabled_modules: Module[]
  /** Set by license enforcement middleware */
  student_limit: number
  /** Set by license enforcement middleware */
  staff_limit: number
  /** Set by license enforcement middleware */
  product_version: string
  /** Set by schema version middleware */
  schema_version: number
}

/**
 * Hono environment type for all Backoffice routes.
 * Usage: new Hono<BackofficeEnv>()
 */
export type BackofficeEnv = { Variables: BackofficeVariables }

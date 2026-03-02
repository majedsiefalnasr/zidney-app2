/**
 * RBAC Module — Barrel Export
 *
 * File: packages/domain-core/src/rbac/index.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Re-exports all public RBAC domain entities.
 * Accessible via `@zidney/domain-core/rbac` (see package.json exports).
 */

export * from './permission-registry'
export * from './rbac.audit'
export * from './rbac.service'
export * from './rbac.types'

/**
 * Backoffice Settings Route Registration — STAGE_018
 *
 * File: apps/api/src/routes/backoffice/settings.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Imports workspace-settings route module and re-exports for
 * mounting under the backoffice route group.
 *
 * Middleware chain applied at app.ts level:
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit(max:60) → authentication
 *
 * RBAC guard for institution admin is applied per-route.
 *
 * Constitutional Compliance:
 * ✓ No business logic — route registration only
 * ✓ No cross-app imports — imports from modules/
 * ✓ Middleware chain inherited from backoffice group
 */

export { workspaceSettingsRouter } from '../../modules/workspace-settings/workspace-settings.routes'

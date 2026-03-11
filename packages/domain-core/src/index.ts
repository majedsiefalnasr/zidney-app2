/**
 * Domain Core Package - Main Entry Point
 *
 * File: packages/domain-core/src/index.ts
 *
 * Central export point for all domain-core modules.
 * Provides unified interface for domain layer functionality.
 */

// Attempts module
export * from './attempts/attempt-init'
// Audit module
export * from './audit/attempt-event-logger'
// Auth module
export * from './auth/index'
// Job hash utility
export * from './job-hash'
// License module
export * from './license/index'
// Logging module
export * from './logging/master-db-logger'
// Migration module
export * from './migration/master-migration-runner'
// Migrations module
export * from './migrations/migrate'
// Monitoring module
export * from './monitoring/provisioning-metrics'
// Provisioning module
export * from './provisioning/idempotency-handler'
// Tenant resolver module
export * from './tenant-resolver/version-check'
// Translation system (Stage 019)
export * from './translation/coverage.service'
export * from './translation/translatable-fields'
export type { TranslationErrorCode } from './translation/translation.errors'
// Translation errors — named imports to avoid conflicts with workflow errors
export {
  batchValidationFailed,
  defaultLanguageWrite,
  invalidFieldName,
  languageRemovalRequiresAsync,
  TRANSLATION_ERROR_CODES,
  TRANSLATION_ERROR_HTTP_STATUS,
  TranslationError,
  unsupportedLanguage,
} from './translation/translation.errors'
export * from './translation/translation.service'
export type * from './translation/translation.types'
// Workers module
export * from './workers/tasks/apply-migration'

// Workflow engine (Stage 020)
export * from './workflow/workflow.engine'
export * from './workflow/workflow.errors'
export * from './workflow/workflow.states'
export type * from './workflow/workflow.types'

// RBAC module (Stage 021) — exported via @zidney/domain-core/rbac subpath only.
// Root barrel re-export is intentionally omitted to avoid name conflicts with
// evaluatePermission (./auth/index) and DbClient (./workflow/workflow.types).
// Import RBAC types/functions using: import { ... } from '@zidney/domain-core/rbac'

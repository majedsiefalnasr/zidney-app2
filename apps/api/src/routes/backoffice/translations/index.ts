/**
 * Translation Routes — Backoffice Router
 *
 * File: apps/api/src/routes/backoffice/translations/index.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Combines all translation route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace/translations in app.ts.
 *
 * Middleware chain is absorbed from the backoffice group:
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit(60) → authentication
 *
 * All routes require an authenticated staff user (JWT validated upstream).
 * No module-specific RBAC guard — translations are permitted for any staff user.
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ All middleware inherited from backoffice group
 * ✓ Standard Hono<BackofficeEnv> type
 */

import { Hono } from 'hono'

import type { BackofficeEnv } from '../types'
import { handleGetCoverage } from './get-coverage'
import { handleGetTranslations } from './get-translations'
import { handlePostUpsert } from './post-upsert'

export const translationRouter = new Hono<BackofficeEnv>()

/**
 * POST /translations
 * Upserts up to 50 translation items atomically.
 * HTTP 200 for both creates and updates (Q4: FR-006 idempotency).
 */
translationRouter.post('/translations', handlePostUpsert)

/**
 * GET /translations/coverage
 * Returns translation coverage stats for entity_type + language_code.
 * MUST be registered BEFORE GET /translations to avoid route conflict.
 */
translationRouter.get('/translations/coverage', handleGetCoverage)

/**
 * GET /translations
 * Returns paginated list of translation rows for entity_type + entity_id.
 */
translationRouter.get('/translations', handleGetTranslations)

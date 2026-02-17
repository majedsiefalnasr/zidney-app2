/**
 * Refresh Token Route
 *
 * File: apps/api/src/routes/auth/refresh-token.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM (Placeholder for Phase 2+)
 * Purpose: Refresh access token using refresh token
 *
 * Context: Future Enhancement
 * - Currently a placeholder (feature under design)
 * - Will support long-lived refresh tokens
 * - Will enable extended sessions without re-authentication
 * - Stage: BACKLOG (implementation deferred to Phase 2)
 *
 * Future Request:
 * POST /auth/refresh-token
 * Body:
 * {
 *   refresh_token: string,
 *   scope: "backoffice" | "frontoffice"
 * }
 *
 * Future Response (200):
 * {
 *   success: true,
 *   data: {
 *     token: string,
 *     refresh_token: string,
 *     expires_at: ISO8601
 *   },
 *   error: null
 * }
 *
 * Design Notes:
 * - Refresh tokens will be long-lived (7-30 days depending on scope)
 * - Access tokens will be short-lived (24 hours during Phase 1)
 * - Refresh tokens stored in DB (encrypted) for revocation capability
 * - Both tokens include token_version for stateless revocation
 * - Requires implementation of refresh_tokens table
 * - Requires AddRefreshTokenSupport migration
 *
 * Current Status:
 * - NOT IMPLEMENTED (Phase 1 uses only access tokens)
 * - Returns 501 Not Implemented
 * - Specifications in design phase
 * - Will be implemented in Phase 2
 */

import { Hono } from 'hono'

const router = new Hono()

/**
 * (Placeholder) Refresh access token
 *
 * Status: NOT YET IMPLEMENTED
 * Reason: Phase 1 focuses on basic login/logout
 * Timeline: Phase 2 (estimated Q2 2025)
 *
 * Implementation will require:
 * 1. Create refresh_tokens table
 * 2. Issue refresh token on login
 * 3. Store refreshtoken in encrypted form
 * 4. Validate refresh token on use
 * 5. Rotate refresh token on each use
 * 6. Clean up expired refresh tokens
 */
router.post('/', async (c) => {
  c.status(501)
  return c.json({
    success: false,
    data: null,
    error: {
      code: 'not_implemented',
      message: 'Token refresh feature is not yet available. Phase 2 feature.',
    },
  })
})

export default router

/**
 * MMC Affiliate Routes Router
 * Stage: STAGE_13_AFFILIATES
 * Purpose: Register all affiliate-related endpoints
 */

import { Hono } from 'hono'
import { createAffiliateHandler } from './affiliates/create'
import { disableAffiliateHandler } from './affiliates/disable'
import { editAffiliateHandler } from './affiliates/edit'
import { listAffiliatesHandler } from './affiliates/list'
import { getAffiliateUsagesHandler } from './affiliates/usages'

/**
 * Create affiliate routes
 * All routes require MMC authentication + admin RBAC
 */
export function createAffiliateRoutes(): Hono {
  const router = new Hono()

  // Create affiliate
  router.post('/affiliates', createAffiliateHandler)

  // List affiliates
  router.get('/affiliates', listAffiliatesHandler)

  // Edit affiliate
  router.patch('/affiliates/:id', editAffiliateHandler)

  // Disable affiliate (soft delete)
  router.post('/affiliates/:id/disable', disableAffiliateHandler)

  // Get affiliate usage history
  router.get('/affiliates/:id/usages', getAffiliateUsagesHandler)

  return router
}

export default createAffiliateRoutes()

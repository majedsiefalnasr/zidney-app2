/**
 * Hierarchy Router — Index
 */

import { PermissionModule } from '@zidney/domain-core/rbac'
import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

import { createPermissionGuard } from '../../../middleware/backoffice-permission-guard-v2'
import type { BackofficeEnv } from '../types'
import { createNodeHandler } from './create-node'
import { deleteNodeHandler } from './delete-node'
import { getNodeHandler } from './get-node'
import { getSubtreeHandler } from './get-subtree'
import { getTreeHandler } from './get-tree'
import { listNodesHandler } from './list-nodes'
import { updateNodeHandler } from './update-node'

const logger = createLogger('backoffice-hierarchy')

export function createHierarchyRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  router.get(
    '/hierarchy-nodes/tree',
    createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_view'),
    getTreeHandler
  )

  router.get(
    '/hierarchy-nodes',
    createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_view'),
    listNodesHandler
  )

  router.post(
    '/hierarchy-nodes',
    createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_create'),
    createNodeHandler
  )

  router.get(
    '/hierarchy-nodes/:id/subtree',
    createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_view'),
    getSubtreeHandler
  )

  router.get(
    '/hierarchy-nodes/:id',
    createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_view'),
    getNodeHandler
  )

  router.patch(
    '/hierarchy-nodes/:id',
    createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_edit'),
    updateNodeHandler
  )

  router.delete(
    '/hierarchy-nodes/:id',
    createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_delete'),
    deleteNodeHandler
  )

  return router
}

export const hierarchyRouter = createHierarchyRouter()

export {
  createNodeHandler,
  deleteNodeHandler,
  getNodeHandler,
  getSubtreeHandler,
  getTreeHandler,
  listNodesHandler,
  updateNodeHandler,
}

export { buildAuditCtx, getDb, hierarchyErrorResponse, successResponse } from './helpers'

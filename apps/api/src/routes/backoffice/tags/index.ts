/**
 * Tags Router — /tags and /tag-relations and /entities
 *
 * File: apps/api/src/routes/backoffice/tags/index.ts
 * Stage: STAGE_32_TAGS
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /tags                                   → listTagsHandler
 *   POST   /tags                                   → [writeGuard] createTagHandler
 *   GET    /tags/:id                               → getTagHandler
 *   PATCH  /tags/:id                               → [writeGuard] updateTagHandler
 *   DELETE /tags/:id                               → [writeGuard] deleteTagHandler
 *   GET    /tags/:id/entities                      → listTagEntitiesHandler
 *   POST   /tag-relations                          → [writeGuard] createTagRelationHandler
 *   DELETE /tag-relations/:id                      → [writeGuard] deleteTagRelationHandler
 *   GET    /entities/:entityType/:entityId/tags    → listEntityTagsHandler
 *
 * Write guard: requireAnyPermission(['question_manage', 'content_manage'])
 */

import { Hono } from 'hono'

import { requireAnyPermission } from '../../../middleware/auth/resolve-rbac'
import type { BackofficeEnv } from '../types'
import { createTagHandler } from './create-tag'
import { createTagRelationHandler } from './create-tag-relation'
import { deleteTagHandler } from './delete-tag'
import { deleteTagRelationHandler } from './delete-tag-relation'
import { getTagHandler } from './get-tag'
import { listEntityTagsHandler } from './list-entity-tags'
import { listTagEntitiesHandler } from './list-tag-entities'
import { listTagsHandler } from './list-tags'
import { updateTagHandler } from './update-tag'

export function createTagsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const writeGuard = requireAnyPermission(['question_manage', 'content_manage'])

  // Tag CRUD
  router.get('/tags', listTagsHandler)
  router.post('/tags', writeGuard, createTagHandler)
  router.get('/tags/:id', getTagHandler)
  router.patch('/tags/:id', writeGuard, updateTagHandler)
  router.delete('/tags/:id', writeGuard, deleteTagHandler)

  // Tag entities view (which entities carry this tag)
  router.get('/tags/:id/entities', listTagEntitiesHandler)

  // Tag relations
  router.post('/tag-relations', writeGuard, createTagRelationHandler)
  router.delete('/tag-relations/:id', writeGuard, deleteTagRelationHandler)

  // Entity tags view (which tags a specific entity has)
  router.get('/entities/:entityType/:entityId/tags', listEntityTagsHandler)

  return router
}

export const tagsRouter = createTagsRouter()

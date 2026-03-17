/**
 * Departments Router — Index
 *
 * File: apps/api/src/routes/backoffice/departments/index.ts
 *
 * Central router for all departments-related API endpoints.
 * Registers routes in CRITICAL dependency order to avoid route conflicts.
 */

import { Hono } from 'hono'
import type { BackofficeEnv } from '../../../types'
import { childrenDepartmentHandler } from './children-department'
import { createDepartmentHandler } from './create-department'
import { deleteDepartmentHandler } from './delete-department'
import { getDepartmentHandler } from './get-department'
import { listDepartmentsHandler } from './list-departments'
import {
  assignStaffDepartmentHandler,
  listStaffDepartmentsHandler,
  removeStaffDepartmentHandler,
} from './staff-departments'
import { treeDepartmentsHandler } from './tree-departments'
import { updateDepartmentHandler } from './update-department'

/**
 * Create departments router with all endpoints.
 * Routes are registered in strict order to avoid UUID parameter conflicts.
 *
 * CRITICAL: /tree and /children must be registered BEFORE /:id to prevent
 * UUID parameter parser from consuming "tree" and "children" as IDs.
 */
export function createDepartmentsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  // Exact match routes first (no params that could match :id)
  router.get('/tree', treeDepartmentsHandler)

  // List route
  router.get('', listDepartmentsHandler)

  // Child/related resource routes are registered before detail routes
  router.get('/:id/children', childrenDepartmentHandler)

  // Post-create route (handles POST /departments)
  router.post('', createDepartmentHandler)

  // Detail routes (/:id with all HTTP methods)
  router.get('/:id', getDepartmentHandler)
  router.put('/:id', updateDepartmentHandler)
  router.delete('/:id', deleteDepartmentHandler)

  // Staff routes (nested resource under /staff/:staffId)
  router.get('/staff/:staffId/departments', listStaffDepartmentsHandler)
  router.post('/staff/:staffId/departments', assignStaffDepartmentHandler)
  router.delete('/staff/:staffId/departments/:departmentId', removeStaffDepartmentHandler)

  return router
}

// Export router factory
export const departmentsRouter = createDepartmentsRouter()

// Re-export all handlers for testing
export {
  listDepartmentsHandler,
  createDepartmentHandler,
  treeDepartmentsHandler,
  childrenDepartmentHandler,
  getDepartmentHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
  listStaffDepartmentsHandler,
  assignStaffDepartmentHandler,
  removeStaffDepartmentHandler,
}

// Re-export helpers for use by other route modules
export { buildAuditCtx, departmentErrorResponse, getDb, successResponse } from './helpers'

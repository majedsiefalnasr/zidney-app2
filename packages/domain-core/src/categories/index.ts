/**
 * Categories domain package barrel.
 *
 * File: packages/domain-core/src/categories/index.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Re-exports the public API of the categories domain.
 * External callers (API routes) import from '@zidney/domain-core/categories'.
 */

export * from './categories.dependency-registry'
export * from './categories.errors'
export * from './categories.service'
export * from './categories.tree'

// Selective type re-exports to keep the public surface explicit
export type {
  AuditContext,
  CategoryRow,
  CategoryStatus,
  CategoryTreeNode,
  CreateCategoryInput,
  DbClient,
  ListCategoriesInput,
  ListCategoriesResult,
  ScopedCategoryRow,
  UpdateCategoryInput,
} from './categories.types'

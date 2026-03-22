/**
 * Category Values domain package barrel.
 *
 * File: packages/domain-core/src/category-values/index.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Re-exports the public API of the category-values domain.
 * External callers (API routes) import from '@zidney/domain-core/category-values'.
 */

export * from './category-values.dependency-registry'
export * from './category-values.errors'
export * from './category-values.service'

// Selective type re-exports to keep the public surface explicit
export type {
  AuditContext,
  CategoryValueRow,
  CategoryValueStatus,
  CreateCategoryValueInput,
  DbClient,
  DeleteCategoryValueResult,
  ListCategoryValuesInput,
  ListCategoryValuesResult,
  ScopedCategoryValueRow,
  TranslationItem,
  UpdateCategoryValueInput,
  WorkspaceLanguageConfig,
} from './category-values.types'

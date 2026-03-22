/**
 * Category Values — Dependency Registry
 *
 * File: packages/domain-core/src/category-values/category-values.dependency-registry.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Extensible registry for dependency-check functions used during deletion.
 * Other domain modules register their checker functions here at runtime.
 */

import type { DbClient } from './category-values.types'

export type DependencyCheckFn = (db: DbClient, categoryValueId: string) => Promise<number>

/** Registry of dependency-check functions. Other modules push into this array. */
export const categoryValueDependencyRegistry: DependencyCheckFn[] = []

/**
 * Run all registered dependency checkers for a category value.
 * Returns the total number of references found across all checkers.
 * A non-zero result means the value cannot be deleted.
 */
export async function checkValueDependencies(
  db: DbClient,
  categoryValueId: string
): Promise<number> {
  const counts = await Promise.all(
    categoryValueDependencyRegistry.map((fn) => fn(db, categoryValueId))
  )
  return counts.reduce((sum, n) => sum + n, 0)
}

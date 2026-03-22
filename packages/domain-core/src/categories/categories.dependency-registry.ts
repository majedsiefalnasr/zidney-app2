/**
 * Categories — Dependency Registry
 *
 * File: packages/domain-core/src/categories/categories.dependency-registry.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Pluggable registry for downstream dependency checks.
 * Downstream stages (MCQ questions, traditional questions) register their
 * check functions here to enable category hard-delete guards.
 *
 * Registry is empty for STAGE_30 — populated by future content stages.
 */

import type { DbClient } from './categories.types'

/**
 * Dependency check function signature.
 * Returns the count of downstream records depending on the given categoryId.
 */
export type DependencyCheckFn = (db: DbClient, categoryId: string) => Promise<number>

/**
 * Global registry of dependency check functions.
 * Mutate by pushing function references from dependent domain packages.
 */
export const categoryDependencyRegistry: DependencyCheckFn[] = []

/**
 * Sum all registered dependency counts for a category.
 * Returns 0 if registry is empty (no downstream content exists yet).
 */
export async function checkCategoryDependencies(db: DbClient, categoryId: string): Promise<number> {
  if (categoryDependencyRegistry.length === 0) return 0
  const counts = await Promise.all(categoryDependencyRegistry.map((fn) => fn(db, categoryId)))
  return counts.reduce((sum, n) => sum + n, 0)
}

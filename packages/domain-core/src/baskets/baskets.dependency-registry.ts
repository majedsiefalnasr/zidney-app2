/**
 * Baskets — Dependency Registry
 *
 * File: packages/domain-core/src/baskets/baskets.dependency-registry.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Extensible registry for dependency-check functions used during basket deletion.
 * Other domain modules (e.g. exam-configurations, auto-selection) may register
 * checker functions here at runtime to prevent basket deletion when references exist.
 *
 * The primary deletion guards (exam_configurations, auto_selection_rules) are
 * implemented directly in baskets.repository.ts using the information_schema guard
 * pattern (AD-004). This registry provides an extension point for future cross-domain
 * dependency expansion beyond those two tables.
 */

import type { DbClient } from './baskets.types'

export type BasketDependencyCheckFn = (db: DbClient, basketId: string) => Promise<number>

/** Registry of dependency-check functions contributed by other domain modules. */
export const basketDependencyRegistry: BasketDependencyCheckFn[] = []

/**
 * Run all registered dependency checkers for a basket.
 * Returns the total count of external references across all checkers.
 * A non-zero result indicates the basket has dependencies in registered modules.
 */
export async function checkBasketDependencies(db: DbClient, basketId: string): Promise<number> {
  const counts = await Promise.all(basketDependencyRegistry.map((fn) => fn(db, basketId)))
  return counts.reduce((sum, n) => sum + n, 0)
}

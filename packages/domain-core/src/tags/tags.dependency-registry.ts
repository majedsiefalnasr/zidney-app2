/**
 * Tags — Dependency Registry
 *
 * File: packages/domain-core/src/tags/tags.dependency-registry.ts
 * Stage: STAGE_32_TAGS
 *
 * Extensible registry for dependency-check functions used during deletion.
 * Other domain modules may register checker functions here at runtime
 * (e.g. to prevent tag deletion when a specific content module still holds references).
 *
 * Tags themselves store their own relation count in tag_relations; this registry
 * is provided for future cross-domain dependency expansion.
 */

import type { DbClient } from './tags.types'

export type TagDependencyCheckFn = (db: DbClient, tagId: string) => Promise<number>

/** Registry of dependency-check functions contributed by other domain modules. */
export const tagDependencyRegistry: TagDependencyCheckFn[] = []

/**
 * Run all registered dependency checkers for a tag.
 * Returns the total count of external references across all checkers.
 * A non-zero result indicates the tag has dependencies outside tag_relations.
 */
export async function checkTagDependencies(db: DbClient, tagId: string): Promise<number> {
  const counts = await Promise.all(tagDependencyRegistry.map((fn) => fn(db, tagId)))
  return counts.reduce((sum, n) => sum + n, 0)
}

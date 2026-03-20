/**
 * Subjects — Dependency Check Registry
 *
 * File: packages/domain-core/src/subjects/subjects.dependency-registry.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * Configurable registry of async dependency check functions.
 * Each function is called before soft-deleting a subject to verify no
 * downstream content references it.
 *
 * At STAGE_28 launch the registry is empty — no downstream content tables
 * (questions, exams, exercises, etc.) exist yet. Downstream stages append
 * their own check functions here during their implementation.
 */

import type { DbClient } from './subjects.types'

// ---------------------------------------------------------------------------
// Dependency Check Function Type
// ---------------------------------------------------------------------------

export type DependencyCheckFn = (db: DbClient, subjectId: string) => Promise<number>

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Registry of dependency check functions.
 * Starts empty at STAGE_28 — downstream stages append entries here.
 */
export const subjectDependencyRegistry: DependencyCheckFn[] = []

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

/**
 * Run all registered dependency checks in parallel and return the total count
 * of dependent records. A count > 0 prevents subject deletion.
 */
export async function checkSubjectDependencies(db: DbClient, subjectId: string): Promise<number> {
  if (subjectDependencyRegistry.length === 0) return 0
  const counts = await Promise.all(subjectDependencyRegistry.map((fn) => fn(db, subjectId)))
  return counts.reduce((sum, n) => sum + n, 0)
}

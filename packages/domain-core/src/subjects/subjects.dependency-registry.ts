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
// Downstream Dependency Checks
// ---------------------------------------------------------------------------

/** STAGE_29: Count lessons that belong to this subject. */
async function countLessonsForSubject(db: DbClient, subjectId: string): Promise<number> {
  interface CountRow extends Record<string, unknown> {
    count: string
  }
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM lessons WHERE subject_id = $1::uuid`,
    [subjectId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Registry of dependency check functions.
 * Populated at STAGE_29 with lessons FK check.
 * Future stages (questions, assessments, etc.) append their own entries.
 */
export const subjectDependencyRegistry: DependencyCheckFn[] = [countLessonsForSubject]

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

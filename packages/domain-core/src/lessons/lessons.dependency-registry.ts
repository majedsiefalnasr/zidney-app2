/**
 * Lessons Dependency Registry — Stub
 *
 * File: packages/domain-core/src/lessons/lessons.dependency-registry.ts
 * Stage: STAGE_29_LESSONS
 *
 * Lessons is a leaf node in the current academic hierarchy — there are no
 * downstream domains yet.  The registry is intentionally empty (returns 0)
 * and is wired following the same DependencyCheckFn + checkLessonDependencies
 * pattern used by subjects.  Future stages (content, assessments, etc.) will
 * push their count functions here.
 */

import type { DbClient } from './lessons.types'

// ---------------------------------------------------------------------------
// DependencyCheckFn contract (matches subjects/subjects.dependency-registry.ts)
// ---------------------------------------------------------------------------

export type DependencyCheckFn = (db: DbClient, lessonId: string) => Promise<number>

// ---------------------------------------------------------------------------
// Registry (empty — lessons is currently a leaf node)
// ---------------------------------------------------------------------------

export const lessonDependencyRegistry: DependencyCheckFn[] = []

// ---------------------------------------------------------------------------
// Aggregator — sum all registered dependency counts
// ---------------------------------------------------------------------------

export async function checkLessonDependencies(db: DbClient, lessonId: string): Promise<number> {
  const counts = await Promise.all(lessonDependencyRegistry.map((checkFn) => checkFn(db, lessonId)))
  return counts.reduce((sum, n) => sum + n, 0)
}

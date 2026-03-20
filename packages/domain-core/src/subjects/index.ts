/**
 * Subjects Domain — Public Barrel
 *
 * File: packages/domain-core/src/subjects/index.ts
 * Stage: STAGE_28_SUBJECTS
 */

export * from './subjects.dependency-registry'
export * from './subjects.errors'
export * from './subjects.service'
export type {
  AuditContext,
  CreateSubjectInput,
  DbClient,
  ListSubjectsInput,
  ListSubjectsResult,
  SubjectRow,
  SubjectStatus,
  TransitionSubjectInput,
  UpdateSubjectInput,
} from './subjects.types'

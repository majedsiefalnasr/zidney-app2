/**
 * Traditional Exams — Public API Barrel
 *
 * File: packages/domain-core/src/traditional-exams/index.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 *
 * Exports the public surface of the traditional-exams domain module.
 * Type-only exports are listed explicitly to keep the surface slim
 * and to avoid exposing internal repository / row-mapper types.
 */

export * from './traditional-exams.dependency-registry'
export * from './traditional-exams.errors'
export * from './traditional-exams.service'
export type {
  AssignQuestionsInput,
  AuditContext,
  CreateTraditionalExamInput,
  DbClient,
  ExamReferenceCheckResult,
  ListTraditionalExamsInput,
  ListTraditionalExamsResult,
  ReorderQuestionsInput,
  TraditionalExamDetail,
  TraditionalExamQuestionRow,
  TraditionalExamRow,
  TraditionalExamSectionRow,
  TraditionalExamSettingsRow,
  TraditionalExamSubsectionRow,
  UpdateExamInput,
  UpdateSectionInput,
  UpdateSubsectionInput,
  UpdateTraditionalExamInput,
  UpsertSettingsInput,
} from './traditional-exams.types'
export {
  TRADITIONAL_EXAM_MODULE_TYPES,
  TRADITIONAL_EXAM_STATUSES,
} from './traditional-exams.types'

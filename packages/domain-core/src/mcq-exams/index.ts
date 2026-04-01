/**
 * MCQ Exams — Public API Barrel
 *
 * File: packages/domain-core/src/mcq-exams/index.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Exports the public surface of the mcq-exams domain module.
 * Type-only exports are listed explicitly to keep the surface slim
 * and to avoid exposing internal repository / row-mapper types.
 */

export * from './mcq-exams.dependency-registry'
export * from './mcq-exams.errors'
export * from './mcq-exams.service'
export type {
  AddExamQuestionsInput,
  AuditContext,
  CreateMcqExamInput,
  CriteriaEntry,
  DbClient,
  DeletionGuardResult,
  ListMcqExamsInput,
  ListMcqExamsResult,
  McqExamAutoCriteriaRow,
  McqExamDetail,
  McqExamPassType,
  McqExamQuestionRow,
  McqExamRow,
  McqExamSelectionMode,
  McqExamSettingsRow,
  McqExamStatus,
  QuestionOrderEntry,
  ReorderQuestionsInput,
  SetCriteriaInput,
  UpdateMcqExamInput,
  UpsertExamSettingsInput,
} from './mcq-exams.types'
export {
  VALID_EXAM_STATUSES,
  VALID_PASS_TYPES,
  VALID_SELECTION_MODES,
} from './mcq-exams.types'

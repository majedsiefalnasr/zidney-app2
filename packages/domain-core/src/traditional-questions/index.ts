/**
 * Traditional Questions — Public API Barrel
 *
 * File: packages/domain-core/src/traditional-questions/index.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Exports the public surface of the traditional-questions domain module.
 * Type-only exports are listed explicitly to keep the surface slim
 * and to avoid exposing internal repository / row-mapper types.
 */

export * from './traditional-questions.dependency-registry'
export * from './traditional-questions.errors'
export * from './traditional-questions.service'
export type {
  AuditContext,
  CreateTraditionalQuestionInput,
  DbClient,
  DeletionGuardResult,
  ListTraditionalQuestionsInput,
  ListTraditionalQuestionsResult,
  TraditionalQuestionCategoryRow,
  TraditionalQuestionDetail,
  TraditionalQuestionRow,
  TraditionalQuestionStatus,
  TraditionalQuestionTagRow,
  TraditionalQuestionType,
  UpdateTraditionalQuestionInput,
} from './traditional-questions.types'
export {
  VALID_TRADITIONAL_QUESTION_STATUSES,
  VALID_TRADITIONAL_QUESTION_TYPES,
} from './traditional-questions.types'

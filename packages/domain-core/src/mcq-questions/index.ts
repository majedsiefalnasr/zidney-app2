/**
 * MCQ Questions — Public API Barrel
 *
 * File: packages/domain-core/src/mcq-questions/index.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Exports the public surface of the mcq-questions domain module.
 * Type-only exports are listed explicitly to keep the surface slim
 * and to avoid exposing internal repository / row-mapper types.
 */

export * from './mcq-questions.dependency-registry'
export * from './mcq-questions.errors'
export * from './mcq-questions.service'
export type {
  AuditContext,
  CreateMcqQuestionInput,
  DbClient,
  DeletionGuardResult,
  ListMcqQuestionsInput,
  ListMcqQuestionsResult,
  McqQuestionBasketRow,
  McqQuestionCategoryRow,
  McqQuestionDetail,
  McqQuestionOptionRow,
  McqQuestionRow,
  McqQuestionStatus,
  McqQuestionTagRow,
  McqQuestionType,
  McqQuestionWithOptions,
  OptionInput,
  UpdateMcqQuestionInput,
} from './mcq-questions.types'
export {
  VALID_QUESTION_STATUSES,
  VALID_QUESTION_TYPES,
} from './mcq-questions.types'

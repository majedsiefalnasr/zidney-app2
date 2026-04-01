/**
 * Traditional Exams — Service Layer
 *
 * File: packages/domain-core/src/traditional-exams/traditional-exams.service.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 *
 * Business logic, transactions, template initialization, structural validation.
 * All TX management lives here — repository is pure SQL.
 */

import { checkTraditionalExamReferences } from './traditional-exams.dependency-registry'
import { TraditionalExamError } from './traditional-exams.errors'
import * as repo from './traditional-exams.repository'
import type {
  AssignQuestionsInput,
  AuditContext,
  CreateTraditionalExamInput,
  DbClient,
  ListTraditionalExamsInput,
  ListTraditionalExamsResult,
  ReorderQuestionsInput,
  TraditionalExamDetail,
  TraditionalExamQuestionRow,
  TraditionalExamRow,
  TraditionalExamSectionRow,
  TraditionalExamSettingsRow,
  TraditionalExamSubsectionRow,
  UpdateSectionInput,
  UpdateSubsectionInput,
  UpdateTraditionalExamInput,
  UpsertSettingsInput,
} from './traditional-exams.types'
import {
  findTransitionRule,
  validatePassPercentage,
  validateStructuralReadiness,
} from './traditional-exams.validators'

// ---------------------------------------------------------------------------
// Create Exam (with template initialization)
// ---------------------------------------------------------------------------

export async function createExam(
  db: DbClient,
  input: CreateTraditionalExamInput,
  audit: AuditContext
): Promise<TraditionalExamRow> {
  // 1. Validate pass_percentage
  const passResult = validatePassPercentage(input.pass_percentage)
  if (!passResult.valid) {
    throw new TraditionalExamError('TRAD_EXAM_ENABLE_VALIDATION', passResult.reason)
  }

  // 2. Validate subject exists
  const subjectOk = await repo.subjectExists(db, input.subject_id)
  if (!subjectOk) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND', 'Subject not found')
  }

  // 3. Check duplicate code
  const codeExists = await repo.existsExamCode(db, input.code)
  if (codeExists) {
    throw new TraditionalExamError('TRAD_EXAM_CODE_EXISTS')
  }

  // 4. Fetch template structure
  const templateSections = await repo.findTemplateSections(db, input.template_id)
  if (templateSections.length === 0) {
    throw new TraditionalExamError('TRAD_EXAM_TEMPLATE_EMPTY')
  }

  const sectionIds = templateSections.map((s) => s.id)
  const templateSubsections = await repo.findTemplateSubsections(db, sectionIds)

  // 5. Begin transaction: insert exam → insert sections → insert subsections
  await db.query('BEGIN')
  try {
    const exam = await repo.insertExam(db, {
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      subject_id: input.subject_id,
      division_id: input.division_id ?? null,
      semester_id: input.semester_id ?? null,
      template_id: input.template_id,
      duration_minutes: input.duration_minutes ?? null,
      pass_percentage: input.pass_percentage,
      module_type: input.module_type,
      created_by: audit.user_id,
    })

    // Insert sections from template
    const sections = await repo.insertSections(
      db,
      exam.id,
      templateSections.map((ts) => ({
        template_section_id: ts.id,
        order_index: ts.order_index,
      }))
    )

    // Map template section IDs to new section IDs
    const sectionIdMap = new Map<string, string>()
    for (let i = 0; i < templateSections.length; i++) {
      sectionIdMap.set(templateSections[i].id, sections[i].id)
    }

    // Insert subsections from template
    if (templateSubsections.length > 0) {
      await repo.insertSubsections(
        db,
        templateSubsections.map((ts) => ({
          section_id: sectionIdMap.get(ts.section_id) ?? '',
          template_subsection_id: ts.id,
          order_index: ts.order_index,
        }))
      )
    }

    await db.query('COMMIT')
    return exam
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// List Exams
// ---------------------------------------------------------------------------

export async function listExams(
  db: DbClient,
  input: ListTraditionalExamsInput,
  _audit: AuditContext
): Promise<ListTraditionalExamsResult> {
  const { data, total } = await repo.listExams(db, input)
  return {
    data,
    total,
    page: input.page,
    per_page: input.per_page,
  }
}

// ---------------------------------------------------------------------------
// Get Exam (with detail)
// ---------------------------------------------------------------------------

export async function getExam(
  db: DbClient,
  examId: string,
  _audit: AuditContext
): Promise<TraditionalExamDetail> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  const [settings, sectionCount, subsectionCount, questionCount, totalScore] = await Promise.all([
    repo.findSettingsByExamId(db, examId),
    repo.countExamSections(db, examId),
    repo.countExamSubsections(db, examId),
    repo.countExamQuestions(db, examId),
    repo.sumExamQuestionScores(db, examId),
  ])

  return {
    ...exam,
    settings,
    section_count: sectionCount,
    subsection_count: subsectionCount,
    question_count: questionCount,
    total_score: totalScore,
  }
}

// ---------------------------------------------------------------------------
// Update Exam
// ---------------------------------------------------------------------------

export async function updateExam(
  db: DbClient,
  examId: string,
  input: UpdateTraditionalExamInput,
  audit: AuditContext
): Promise<TraditionalExamRow> {
  await db.query('BEGIN')
  try {
    const exam = await repo.findExamByIdForUpdate(db, examId)
    if (!exam) {
      throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
    }

    // Only DRAFT or UNDER_REVIEW can be edited
    if (exam.status !== 'DRAFT' && exam.status !== 'UNDER_REVIEW') {
      throw new TraditionalExamError('TRAD_EXAM_STATUS_LOCKED')
    }

    // Cannot change subject if questions assigned
    if (input.subject_id !== undefined && input.subject_id !== exam.subject_id) {
      const hasQuestions = await repo.hasQuestionsAssigned(db, examId)
      if (hasQuestions) {
        throw new TraditionalExamError('TRAD_EXAM_SUBJECT_IMMUTABLE')
      }
    }

    // Validate pass_percentage if provided
    if (input.pass_percentage !== undefined) {
      const passResult = validatePassPercentage(input.pass_percentage)
      if (!passResult.valid) {
        throw new TraditionalExamError('TRAD_EXAM_ENABLE_VALIDATION', passResult.reason)
      }
    }

    // Check code uniqueness if changing
    if (input.code !== undefined && input.code.toLowerCase() !== exam.code.toLowerCase()) {
      const codeExists = await repo.existsExamCode(db, input.code, examId)
      if (codeExists) {
        throw new TraditionalExamError('TRAD_EXAM_CODE_EXISTS')
      }
    }

    // Build update fields
    const fields: Record<string, unknown> = {}
    if (input.name !== undefined) fields.name = input.name
    if (input.code !== undefined) fields.code = input.code
    if (input.description !== undefined) fields.description = input.description
    if (input.division_id !== undefined) fields.division_id = input.division_id
    if (input.semester_id !== undefined) fields.semester_id = input.semester_id
    if (input.duration_minutes !== undefined) fields.duration_minutes = input.duration_minutes
    if (input.pass_percentage !== undefined) fields.pass_percentage = input.pass_percentage
    if (input.module_type !== undefined) fields.module_type = input.module_type

    const updated = await repo.updateExam(db, examId, fields, audit.user_id)
    await db.query('COMMIT')
    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Delete Exam (soft)
// ---------------------------------------------------------------------------

export async function deleteExam(db: DbClient, examId: string, audit: AuditContext): Promise<void> {
  await db.query('BEGIN')
  try {
    const exam = await repo.findExamByIdForUpdate(db, examId)
    if (!exam) {
      throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
    }

    if (exam.status !== 'DRAFT') {
      throw new TraditionalExamError('TRAD_EXAM_STATUS_LOCKED')
    }

    // Check external references (deletion guard)
    const refs = await checkTraditionalExamReferences(db, examId)
    if (refs.hasReferences) {
      throw new TraditionalExamError('TRAD_EXAM_DELETION_BLOCKED')
    }

    await repo.softDeleteExam(db, examId, audit.user_id)
    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Transition Exam Status
// ---------------------------------------------------------------------------

export async function transitionExam(
  db: DbClient,
  examId: string,
  targetStatus: string,
  audit: AuditContext,
  reason?: string
): Promise<TraditionalExamRow> {
  await db.query('BEGIN')
  try {
    const exam = await repo.findExamByIdForUpdate(db, examId)
    if (!exam) {
      throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
    }

    const rule = findTransitionRule(exam.status, targetStatus)
    if (!rule) {
      throw new TraditionalExamError('TRAD_EXAM_INVALID_TRANSITION')
    }

    // If return transition, reason is required
    if (rule.requiresReason && !reason) {
      throw new TraditionalExamError('TRAD_EXAM_RETURN_REASON_REQUIRED')
    }

    // Pre-ENABLED structural validation
    if (targetStatus === 'ENABLED') {
      await performEnableValidation(db, exam)
    }

    const updated = await repo.updateExamStatus(db, examId, targetStatus, audit.user_id)
    await db.query('COMMIT')
    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Structural Validation (Pre-ENABLED)
// ---------------------------------------------------------------------------

async function performEnableValidation(db: DbClient, exam: TraditionalExamRow): Promise<void> {
  // Fetch template section count
  const templateSections = await repo.findTemplateSections(db, exam.template_id)
  const templateSectionCount = templateSections.length

  const templateSubsections = await repo.findTemplateSubsections(
    db,
    templateSections.map((s) => s.id)
  )

  // Group template subsections by section
  const templateSubsectionsBySection = new Map<string, number>()
  for (const ts of templateSubsections) {
    templateSubsectionsBySection.set(
      ts.section_id,
      (templateSubsectionsBySection.get(ts.section_id) ?? 0) + 1
    )
  }

  // Fetch exam counts
  const examSectionCount = await repo.countExamSections(db, exam.id)
  const subsectionCounts = await repo.countSubsectionsPerSection(db, exam.id)
  const questionCounts = await repo.countQuestionsPerSubsection(db, exam.id)
  const totalScore = await repo.sumExamQuestionScores(db, exam.id)

  // Fetch settings for chrono mode check
  const settings = await repo.findSettingsByExamId(db, exam.id)

  const failures = validateStructuralReadiness({
    exam_section_count: examSectionCount,
    template_section_count: templateSectionCount,
    subsection_counts: subsectionCounts.map((sc) => ({
      section_id: sc.section_id,
      exam_count: sc.count,
      template_count: templateSubsectionsBySection.get(sc.section_id) ?? 0,
    })),
    subsections_with_questions: questionCounts.map((qc) => ({
      subsection_id: qc.subsection_id,
      question_count: qc.count,
    })),
    pass_percentage: Number(exam.pass_percentage),
    total_score: Number(totalScore),
    duration_minutes: exam.duration_minutes,
    has_chrono_mode: settings?.auto_submit_on_timeout ?? false,
  })

  if (failures.length > 0) {
    throw new TraditionalExamError('TRAD_EXAM_ENABLE_VALIDATION', failures)
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(
  db: DbClient,
  examId: string,
  _audit: AuditContext
): Promise<TraditionalExamSettingsRow> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  const settings = await repo.findSettingsByExamId(db, examId)
  if (!settings) {
    throw new TraditionalExamError('TRAD_EXAM_SETTINGS_NOT_FOUND')
  }
  return settings
}

export async function upsertSettings(
  db: DbClient,
  examId: string,
  input: UpsertSettingsInput,
  _audit: AuditContext
): Promise<TraditionalExamSettingsRow> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  return repo.upsertSettings(db, examId, {
    shuffle_questions: input.shuffle_questions,
    shuffle_options: input.shuffle_options,
    show_results_immediately: input.show_results_immediately,
    allow_back_navigation: input.allow_back_navigation,
    auto_submit_on_timeout: input.auto_submit_on_timeout,
    show_question_score: input.show_question_score,
    require_answer_before_next: input.require_answer_before_next,
    show_remaining_time: input.show_remaining_time,
    allow_flag_questions: input.allow_flag_questions,
    enable_auto_grading: input.enable_auto_grading,
    message_template_id: input.message_template_id ?? null,
  })
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function listSections(
  db: DbClient,
  examId: string,
  _audit: AuditContext
): Promise<Array<TraditionalExamSectionRow & { subsections: TraditionalExamSubsectionRow[] }>> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  const sections = await repo.listSections(db, examId)
  const result: Array<TraditionalExamSectionRow & { subsections: TraditionalExamSubsectionRow[] }> =
    []

  for (const section of sections) {
    const subsections = await repo.listSubsections(db, section.id)
    result.push({ ...section, subsections })
  }

  return result
}

export async function updateSection(
  db: DbClient,
  examId: string,
  sectionId: string,
  input: UpdateSectionInput,
  _audit: AuditContext
): Promise<TraditionalExamSectionRow> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  if (exam.status !== 'DRAFT' && exam.status !== 'UNDER_REVIEW') {
    throw new TraditionalExamError('TRAD_EXAM_STATUS_LOCKED')
  }

  const section = await repo.findSectionById(db, sectionId, examId)
  if (!section) {
    throw new TraditionalExamError('TRAD_EXAM_SECTION_NOT_FOUND')
  }

  const fields: Record<string, unknown> = {}
  if (input.header_content !== undefined) fields.header_content = input.header_content
  if (input.order_index !== undefined) fields.order_index = input.order_index

  return repo.updateSection(db, sectionId, fields)
}

// ---------------------------------------------------------------------------
// Subsections
// ---------------------------------------------------------------------------

export async function updateSubsection(
  db: DbClient,
  examId: string,
  sectionId: string,
  subsectionId: string,
  input: UpdateSubsectionInput,
  _audit: AuditContext
): Promise<TraditionalExamSubsectionRow> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  if (exam.status !== 'DRAFT' && exam.status !== 'UNDER_REVIEW') {
    throw new TraditionalExamError('TRAD_EXAM_STATUS_LOCKED')
  }

  const section = await repo.findSectionById(db, sectionId, examId)
  if (!section) {
    throw new TraditionalExamError('TRAD_EXAM_SECTION_NOT_FOUND')
  }

  const subsection = await repo.findSubsectionById(db, subsectionId, sectionId)
  if (!subsection) {
    throw new TraditionalExamError('TRAD_EXAM_SUBSECTION_NOT_FOUND')
  }

  const fields: Record<string, unknown> = {}
  if (input.header_content !== undefined) fields.header_content = input.header_content
  if (input.order_index !== undefined) fields.order_index = input.order_index

  return repo.updateSubsection(db, subsectionId, fields)
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function listSubsectionQuestions(
  db: DbClient,
  subsectionId: string,
  _audit: AuditContext
): Promise<TraditionalExamQuestionRow[]> {
  return repo.listQuestionsBySubsection(db, subsectionId)
}

export async function assignQuestions(
  db: DbClient,
  examId: string,
  sectionId: string,
  subsectionId: string,
  input: AssignQuestionsInput,
  _audit: AuditContext
): Promise<TraditionalExamQuestionRow[]> {
  // Validate exam exists and is editable
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  if (exam.status !== 'DRAFT' && exam.status !== 'UNDER_REVIEW') {
    throw new TraditionalExamError('TRAD_EXAM_STATUS_LOCKED')
  }

  // Validate section and subsection chain
  const section = await repo.findSectionById(db, sectionId, examId)
  if (!section) {
    throw new TraditionalExamError('TRAD_EXAM_SECTION_NOT_FOUND')
  }

  const subsection = await repo.findSubsectionById(db, subsectionId, sectionId)
  if (!subsection) {
    throw new TraditionalExamError('TRAD_EXAM_SUBSECTION_NOT_FOUND')
  }

  // Validate questions
  const questionIds = input.questions.map((q) => q.question_id)
  const questionInfos = await repo.findQuestionInfo(db, questionIds)
  const questionMap = new Map(questionInfos.map((q) => [q.id, q]))

  for (const q of input.questions) {
    const info = questionMap.get(q.question_id)
    if (!info) {
      throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND', `Question ${q.question_id} not found`)
    }
    if (info.subject_id !== exam.subject_id) {
      throw new TraditionalExamError('TRAD_EXAM_QUESTION_SUBJECT_MISMATCH')
    }
    if (info.status !== 'ENABLED') {
      throw new TraditionalExamError('TRAD_EXAM_QUESTION_NOT_ENABLED')
    }
  }

  // Get current max order_index
  const existing = await repo.listQuestionsBySubsection(db, subsectionId)
  let nextOrder = existing.length > 0 ? Math.max(...existing.map((q) => q.order_index)) + 1 : 0

  const toInsert = input.questions.map((q) => ({
    question_id: q.question_id,
    score: q.score,
    order_index: nextOrder++,
  }))

  return repo.assignQuestions(db, subsectionId, toInsert)
}

export async function removeQuestion(
  db: DbClient,
  examId: string,
  _sectionId: string,
  subsectionId: string,
  questionId: string,
  _audit: AuditContext
): Promise<void> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  if (exam.status !== 'DRAFT' && exam.status !== 'UNDER_REVIEW') {
    throw new TraditionalExamError('TRAD_EXAM_STATUS_LOCKED')
  }

  await repo.removeQuestion(db, subsectionId, questionId)
}

export async function reorderQuestions(
  db: DbClient,
  examId: string,
  _sectionId: string,
  subsectionId: string,
  input: ReorderQuestionsInput,
  _audit: AuditContext
): Promise<TraditionalExamQuestionRow[]> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) {
    throw new TraditionalExamError('TRAD_EXAM_NOT_FOUND')
  }

  if (exam.status !== 'DRAFT' && exam.status !== 'UNDER_REVIEW') {
    throw new TraditionalExamError('TRAD_EXAM_STATUS_LOCKED')
  }

  await db.query('BEGIN')
  try {
    // Fetch existing questions for scores
    const existing = await repo.listQuestionsBySubsection(db, subsectionId)
    const scoreMap = new Map(existing.map((q) => [q.question_id, q.score]))

    // Delete and re-insert in new order
    await repo.deleteQuestionsBySubsection(db, subsectionId)

    const reordered = input.question_ids.map((qid, idx) => ({
      question_id: qid,
      score: scoreMap.get(qid) ?? '0',
      order_index: idx,
    }))

    const result = await repo.insertQuestionsWithOrder(db, subsectionId, reordered)
    await db.query('COMMIT')
    return result
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

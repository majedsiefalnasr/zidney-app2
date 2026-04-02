/**
 * Auto-Selection Engine — Test Fixtures
 *
 * File: apps/api/tests/fixtures/auto-selection.fixture.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 *
 * Deterministic fixture factories for auto-selection unit and integration tests.
 * All UUIDs are stable — tests that need distinct IDs should override via spread.
 */

// ---------------------------------------------------------------------------
// UUIDs (stable across test runs)
// ---------------------------------------------------------------------------

export const FIXTURE_WORKSPACE_ID = '10000000-0000-0000-0000-000000000001'
export const FIXTURE_USER_ID = '20000000-0000-0000-0000-000000000001'
export const FIXTURE_EXAM_ID = '30000000-0000-0000-0000-000000000001'
export const FIXTURE_ATTEMPT_ID = '40000000-0000-0000-0000-000000000001'
export const FIXTURE_CRITERIA_ID = '50000000-0000-0000-0000-000000000001'

// Question pool — 20 stable UUIDs
export const FIXTURE_QUESTION_IDS = Array.from(
  { length: 20 },
  (_, i) => `60000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
)

// Category / lesson / tag / basket UUIDs
export const FIXTURE_CATEGORY_ID = '70000000-0000-0000-0000-000000000001'
export const FIXTURE_LESSON_ID = '80000000-0000-0000-0000-000000000001'
export const FIXTURE_TAG_ID = '90000000-0000-0000-0000-000000000001'
export const FIXTURE_BASKET_ID = 'a0000000-0000-0000-0000-000000000001'
export const FIXTURE_SEMESTER_ID = 'b0000000-0000-0000-0000-000000000001'

// Idempotency key
export const FIXTURE_IDEMPOTENCY_KEY = 'test-idempotency-key-001'

// ---------------------------------------------------------------------------
// Criteria fixtures
// ---------------------------------------------------------------------------

export interface AutoCriteriaEntry {
  id: string
  exam_id: string
  lesson_ids: string[] | null
  category_value_ids: string[] | null
  tag_ids: string[] | null
  basket_ids: string[] | null
  category_ids: string[] | null
  semester_id: string | null
  percentage: number | null
  fixed_count: number | null
}

/**
 * Single criteria block using percentage quota
 */
export function makePercentageCriteria(
  overrides: Partial<AutoCriteriaEntry> = {}
): AutoCriteriaEntry {
  return {
    id: FIXTURE_CRITERIA_ID,
    exam_id: FIXTURE_EXAM_ID,
    lesson_ids: [FIXTURE_LESSON_ID],
    category_value_ids: null,
    tag_ids: null,
    basket_ids: null,
    category_ids: null,
    semester_id: null,
    percentage: 100,
    fixed_count: null,
    ...overrides,
  }
}

/**
 * Single criteria block using fixed_count quota
 */
export function makeFixedCountCriteria(
  overrides: Partial<AutoCriteriaEntry> = {}
): AutoCriteriaEntry {
  return {
    id: FIXTURE_CRITERIA_ID,
    exam_id: FIXTURE_EXAM_ID,
    lesson_ids: null,
    category_value_ids: null,
    tag_ids: null,
    basket_ids: null,
    category_ids: [FIXTURE_CATEGORY_ID],
    semester_id: null,
    percentage: null,
    fixed_count: 5,
    ...overrides,
  }
}

/**
 * Multiple criteria blocks — percentage split 60/40
 */
export function makeMultiCriteria(): AutoCriteriaEntry[] {
  return [
    {
      id: '50000000-0000-0000-0000-000000000001',
      exam_id: FIXTURE_EXAM_ID,
      lesson_ids: [FIXTURE_LESSON_ID],
      category_value_ids: null,
      tag_ids: null,
      basket_ids: null,
      category_ids: null,
      semester_id: null,
      percentage: 60,
      fixed_count: null,
    },
    {
      id: '50000000-0000-0000-0000-000000000002',
      exam_id: FIXTURE_EXAM_ID,
      lesson_ids: null,
      category_value_ids: null,
      tag_ids: null,
      basket_ids: null,
      category_ids: [FIXTURE_CATEGORY_ID],
      semester_id: null,
      percentage: 40,
      fixed_count: null,
    },
  ]
}

// ---------------------------------------------------------------------------
// Exam fixtures
// ---------------------------------------------------------------------------

export interface ExamFixture {
  id: string
  workspace_id: string
  total_questions: number
  selection_mode: string
  status: string
  duration_minutes: number | null
}

export function makeAutoExam(overrides: Partial<ExamFixture> = {}): ExamFixture {
  return {
    id: FIXTURE_EXAM_ID,
    workspace_id: FIXTURE_WORKSPACE_ID,
    total_questions: 10,
    selection_mode: 'AUTOMATIC',
    status: 'ENABLED',
    duration_minutes: 30,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Idempotency key fixture
// ---------------------------------------------------------------------------

export interface IdempotencyClaimFixture {
  id: string
  workspace_id: string
  user_id: string
  exam_id: string
  idempotency_key: string
  attempt_id: string | null
  payload_hash: string | null
  claimed_at: Date
  expires_at: Date
}

export function makeIdempotencyClaim(
  overrides: Partial<IdempotencyClaimFixture> = {}
): IdempotencyClaimFixture {
  const now = new Date()
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h TTL
  return {
    id: 'c0000000-0000-0000-0000-000000000001',
    workspace_id: FIXTURE_WORKSPACE_ID,
    user_id: FIXTURE_USER_ID,
    exam_id: FIXTURE_EXAM_ID,
    idempotency_key: FIXTURE_IDEMPOTENCY_KEY,
    attempt_id: null,
    payload_hash: null,
    claimed_at: now,
    expires_at: expires,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Attempt fixture
// ---------------------------------------------------------------------------

export interface AttemptFixture {
  id: string
  workspace_id: string
  user_id: string
  exam_id: string
  selection_seed: string | null
  candidate_pool_fingerprint: string | null
  selection_diagnostics: Record<string, unknown> | null
}

export function makeAttemptWithSelection(
  overrides: Partial<AttemptFixture> = {}
): AttemptFixture {
  return {
    id: FIXTURE_ATTEMPT_ID,
    workspace_id: FIXTURE_WORKSPACE_ID,
    user_id: FIXTURE_USER_ID,
    exam_id: FIXTURE_EXAM_ID,
    selection_seed: 'test-seed-abc123',
    candidate_pool_fingerprint: 'sha256:abcdef1234567890',
    selection_diagnostics: {
      criteria_block_count: 1,
      pool_sizes: [20],
      selected_count: 10,
      duplicate_count: 0,
    },
    ...overrides,
  }
}

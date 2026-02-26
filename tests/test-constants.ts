/**
 * Test Constants
 * Shared constants used across all tests
 */

// Test Workspace Identifiers
export const TEST_WORKSPACES = {
  WS_A: 'test-ws-a',
  WS_B: 'test-ws-b',
  WS_CONCURRENT: 'test-ws-concurrent',
} as const

// Test User IDs
export const TEST_USERS = {
  USER_A: 'user-a-id',
  USER_B: 'user-b-id',
  USER_STAFF: 'user-staff-id',
  USER_ADMIN: 'user-admin-id',
} as const

// Test Email Addresses
export const TEST_EMAILS = {
  USER_A: 'user-a@test.com',
  USER_B: 'user-b@test.com',
  STAFF: 'staff@test.com',
  ADMIN: 'admin@test.com',
  NONEXISTENT: 'nonexistent@test.com',
} as const

// License Limits
export const TEST_LICENSE_LIMITS = {
  STUDENT_LIMIT: 1000,
  STAFF_LIMIT: 100,
  EXAM_LIMIT: 500,
} as const

// Rate Limiting
export const TEST_RATE_LIMITS = {
  LOGIN_LIMIT_PER_MIN: 5,
  API_LIMIT_PER_HOUR: 1000,
  SUBMISSION_LIMIT_IDEMPOTENT: -1, // No limit for idempotent submissions
} as const

// Timeouts
export const TEST_TIMEOUTS = {
  LOCK_TIMEOUT_MS: 60000,
  PROVISION_TIMEOUT_MS: 30000,
  ATTEMPT_DEADLINE_MS: 3600000, // 1 hour
  MIDDLEWARE_TIMEOUT_MS: 1000,
} as const

// Performance Baselines (milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  MIDDLEWARE_OVERHEAD_MAX_MS: 1.0, // P95
  MIDDLEWARE_OVERHEAD_P99_MS: 1.5,
  LICENSE_CHECK_MAX_MS: 5.0, // P95
  LICENSE_CHECK_P99_MS: 7.0,
  LOCK_RESOLUTION_MAX_MS: 50.0, // P95 acquisition
  LOCK_RELEASE_MAX_MS: 50.0, // P95 release
} as const

// Test Data
export const TEST_DATA = {
  EXAM_DURATION_MINUTES: 60,
  EXAM_PASS_THRESHOLD: 60,
  EXAM_PASSING_GRADE: 'D',
  EXAM_QUESTIONS: 5,
  EXAM_POINTS: 100,
} as const

// Valid Credentials
export const TEST_CREDENTIALS = {
  PASSWORD_VALID: 'test123',
  PASSWORD_INVALID: 'wrong_password',
  PASSWORD_EMPTY: '',
} as const

// UTC Timestamps for testing
export const TEST_TIMESTAMPS = {
  NOW: new Date().toISOString(),
  DEADLINE_IN_1_HOUR: new Date(Date.now() + 3600000).toISOString(),
  PAST_TIME: new Date(Date.now() - 3600000).toISOString(),
} as const

// Test correlation IDs
export const TEST_CORRELATION_IDS = {
  REQUEST_1: 'corr-id-req-001',
  REQUEST_2: 'corr-id-req-002',
  REQUEST_3: 'corr-id-req-003',
} as const

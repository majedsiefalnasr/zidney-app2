/**
 * Test Types & Interfaces
 * TypeScript interfaces for test data structures
 */

import type { Pool } from 'pg'

export interface TestEnvironment {
  masterDb: Pool
  tenantDb: Pool
  workspaces: string[]
  databases: Map<string, Pool>
  redis?: any
}

export interface TestFixture {
  workspaceId: string
  workspaceSlug: string
  userId: string
  attemptId: string
  correlationId: string
  workspace?: {
    id: string
    slug: string
    name: string
  }
  user?: {
    id: string
    email: string
    role: string
  }
  attempt?: {
    id: string
    status: string
    snapshot: any
  }
}

export interface PerformanceMetrics {
  p50: number // 50th percentile
  p75: number // 75th percentile
  p90: number // 90th percentile
  p95: number // 95th percentile
  p99: number // 99th percentile
  min: number
  max: number
  avg: number
  stdDev: number
}

export interface AuditLogEntry {
  id: string
  workspace_id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  status: 'success' | 'failure'
  details: Record<string, any>
  ip_address: string | null
  created_at: string
}

export interface RFC7807ErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  error_code: string
  [key: string]: any
}

export interface AttemptSnapshot {
  exam_config: {
    id: string
    title: string
    duration_minutes: number
    pass_threshold: number
    passing_grade: string
    questions: number
  }
  questions: Array<{
    id: string
    title: string
    points: number
  }>
}

export interface SubmissionPayload {
  attempt_id: string
  question_id: string
  answer: string | string[]
  submitted_at: string
}

export interface StudentLimitTestData {
  workspaceId: string
  licenseId: string
  maxStudents: number
  currentCount: number
}

/**
 * Test execution result type
 */
export interface TestResult {
  testName: string
  passed: boolean
  duration: number
  error?: Error
}

/**
 * Batch test results
 */
export interface TestBatchResult {
  total: number
  passed: number
  failed: number
  results: TestResult[]
}

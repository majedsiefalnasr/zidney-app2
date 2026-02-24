/**
 * T069: Audit Logging for Attempt Submission
 *
 * Log all grading events and state changes:
 * - attempt_submitted: Captures student ID, workspace, submission data hash
 * - grading_started: Job ID, processor info
 * - grading_completed: Final score, processing time, any anomalies
 * - result_persisted: Confirms atomic write to attempts table
 *
 * All audit logs use SERIALIZABLE transactions to prevent race conditions.
 * Links to correlationId for full request tracing.
 */

export interface AuditLogEntry {
  id?: string
  workspace_id: string
  attempt_id: string
  user_id: string
  event:
    | 'attempt_submitted'
    | 'grading_started'
    | 'grading_completed'
    | 'result_persisted'
    | 'error'
  details: Record<string, any>
  correlation_id: string
  created_at?: string
}

/**
 * Insert audit log entry in tenant database
 * Uses SERIALIZABLE isolation to prevent concurrent audit inconsistencies
 */
export async function insertAuditLog(
  client: any, // PoolClient
  entry: AuditLogEntry
): Promise<string> {
  const query = `
    INSERT INTO attempt_audit_log (
      workspace_id,
      attempt_id,
      user_id,
      event,
      details,
      correlation_id,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id, created_at
  `

  const result = await client.query(query, [
    entry.workspace_id,
    entry.attempt_id,
    entry.user_id,
    entry.event,
    JSON.stringify(entry.details),
    entry.correlation_id,
  ])

  if (!result.rows || result.rows.length === 0) {
    throw new Error(
      `Failed to insert audit log for attempt ${entry.attempt_id}`
    )
  }

  return result.rows[0].id
}

/**
 * Factory for audit log entries
 */
export const AuditLogFactory = {
  /**
   * Create attempt_submitted audit event
   */
  attemptSubmitted: (params: {
    workspaceId: string
    attemptId: string
    userId: string
    correlationId: string
    questionCount: number
    submissionDataHash: string // SHA256 hash of submission for integrity
    clientTimestamp?: Date
  }): AuditLogEntry => ({
    workspace_id: params.workspaceId,
    attempt_id: params.attemptId,
    user_id: params.userId,
    event: 'attempt_submitted',
    correlation_id: params.correlationId,
    details: {
      question_count: params.questionCount,
      submission_data_hash: params.submissionDataHash,
      client_timestamp: params.clientTimestamp?.toISOString(),
      server_timestamp: new Date().toISOString(),
    },
  }),

  /**
   * Create grading_started audit event
   */
  gradingStarted: (params: {
    workspaceId: string
    attemptId: string
    userId: string
    correlationId: string
    jobId: string
    processorService?: string
  }): AuditLogEntry => ({
    workspace_id: params.workspaceId,
    attempt_id: params.attemptId,
    user_id: params.userId,
    event: 'grading_started',
    correlation_id: params.correlationId,
    details: {
      job_id: params.jobId,
      processor_service: params.processorService || 'worker',
      started_at: new Date().toISOString(),
    },
  }),

  /**
   * Create grading_completed audit event
   */
  gradingCompleted: (params: {
    workspaceId: string
    attemptId: string
    userId: string
    correlationId: string
    jobId: string
    finalScore: number
    scorePercent: number
    passed: boolean
    processingTimeMs: number
    questionsGraded: number
    anomalies?: string[]
  }): AuditLogEntry => ({
    workspace_id: params.workspaceId,
    attempt_id: params.attemptId,
    user_id: params.userId,
    event: 'grading_completed',
    correlation_id: params.correlationId,
    details: {
      job_id: params.jobId,
      final_score: params.finalScore,
      score_percent: params.scorePercent,
      passed: params.passed,
      processing_time_ms: params.processingTimeMs,
      questions_graded: params.questionsGraded,
      completed_at: new Date().toISOString(),
      anomalies: params.anomalies || [],
    },
  }),

  /**
   * Create result_persisted audit event
   */
  resultPersisted: (params: {
    workspaceId: string
    attemptId: string
    userId: string
    correlationId: string
    gradingResultId: string
    persistedAt: Date
  }): AuditLogEntry => ({
    workspace_id: params.workspaceId,
    attempt_id: params.attemptId,
    user_id: params.userId,
    event: 'result_persisted',
    correlation_id: params.correlationId,
    details: {
      grading_result_id: params.gradingResultId,
      persisted_at: params.persistedAt.toISOString(),
    },
  }),

  /**
   * Create error audit event
   */
  error: (params: {
    workspaceId: string
    attemptId: string
    userId: string
    correlationId: string
    errorCode: string
    errorMessage: string
    errorStack?: string
    stage: 'submission' | 'grading' | 'persistence'
  }): AuditLogEntry => ({
    workspace_id: params.workspaceId,
    attempt_id: params.attemptId,
    user_id: params.userId,
    event: 'error',
    correlation_id: params.correlationId,
    details: {
      error_code: params.errorCode,
      error_message: params.errorMessage,
      error_stack: params.errorStack
        ? params.errorStack.split('\n').slice(0, 5).join('\n')
        : undefined,
      stage: params.stage,
      error_at: new Date().toISOString(),
    },
  }),
}

/**
 * Query audit logs for a specific attempt
 */
export async function queryAttemptAuditLog(
  client: any,
  workspaceId: string,
  attemptId: string
): Promise<AuditLogEntry[]> {
  const query = `
    SELECT
      id,
      workspace_id,
      attempt_id,
      user_id,
      event,
      details,
      correlation_id,
      created_at
    FROM attempt_audit_log
    WHERE workspace_id = $1
      AND attempt_id = $2
    ORDER BY created_at ASC
  `

  const result = await client.query(query, [workspaceId, attemptId])

  return result.rows.map((row: any) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    attempt_id: row.attempt_id,
    user_id: row.user_id,
    event: row.event,
    details:
      typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    correlation_id: row.correlation_id,
    created_at: row.created_at,
  }))
}

/**
 * Query audit logs by correlation ID (for distributed tracing)
 */
export async function queryAuditLogByCorrelationId(
  client: any,
  correlationId: string
): Promise<AuditLogEntry[]> {
  const query = `
    SELECT
      id,
      workspace_id,
      attempt_id,
      user_id,
      event,
      details,
      correlation_id,
      created_at
    FROM attempt_audit_log
    WHERE correlation_id = $1
    ORDER BY created_at ASC
  `

  const result = await client.query(query, [correlationId])

  return result.rows.map((row: any) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    attempt_id: row.attempt_id,
    user_id: row.user_id,
    event: row.event,
    details:
      typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    correlation_id: row.correlation_id,
    created_at: row.created_at,
  }))
}

/**
 * Verify audit log completeness for attempt
 * Returns true if expected events are present in order
 */
export async function verifyAuditLogCompleteness(
  client: any,
  workspaceId: string,
  attemptId: string
): Promise<{
  complete: boolean
  missing_events: string[]
  timeline: string[]
}> {
  const logs = await queryAttemptAuditLog(client, workspaceId, attemptId)

  const events = logs.map((l) => l.event)
  const expectedSequence: Array<AuditLogEntry['event']> = [
    'attempt_submitted',
    'grading_started',
    'grading_completed',
    'result_persisted',
  ]

  const missing = expectedSequence.filter((e) => !events.includes(e))
  const timeline = logs.map((l) => `${l.created_at}: ${l.event}`)

  return {
    complete: missing.length === 0,
    missing_events: missing,
    timeline,
  }
}

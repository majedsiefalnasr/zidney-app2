/**
 * Core type definitions for scripts/ai-engine/.
 *
 * These types define the schema for execution logs, sub-command results, brain status,
 * validation reports, execution plans, and CLI argument shapes used across all three
 * orchestration entry points (run-task.ts, plan-task.ts, validate-execution.ts).
 * @library-module
 */

/**
 * Execution log artifact written to docs/architecture/health/ai-execution-logs/{execution_id}.json
 * All mandatory fields defined in spec FR-009 and Observability Requirements (SC-003).
 */
export interface ExecutionLog {
  execution_id: string
  task_id: string
  timestamp: string // ISO 8601 — server process time (Date.now())
  command: 'ai:run' | 'ai:plan' | 'ai:validate'
  skills_activated: string[] // Skill directory names; empty for ai:validate
  files_modified: string[] // Relative paths; empty for ai:plan and ai:validate
  architecture_violations: number
  validation_result: 'pass' | 'fail'
  execution_duration_ms: number
  error: string | null // Present only on failure; null on success
}

/** Sub-command result from a governance tool invocation */
export interface SubCommandResult {
  command: string
  exit_code: number
  duration_ms: number
  timed_out: boolean
}

/** Brain status enumeration */
export type BrainStatus = 'present_fresh' | 'stale' | 'absent'

/** Full validation report embedded in execution log for ai:validate */
export interface ValidationReport {
  brain_status: BrainStatus
  brain_path: string
  arch_guard: SubCommandResult
  type_safety_guard: SubCommandResult
  arch_health: SubCommandResult
  architecture_violations: number // Aggregate count across all tools
  overall: 'pass' | 'fail'
}

/** Execution plan document written by plan-task.ts */
export interface ExecutionPlan {
  execution_id: string
  task_id: string
  timestamp: string
  task_description: string
  skills_required: string[]
  steps: PlanStep[]
  architecture_constraints: string[]
  risk_level: 'low' | 'medium' | 'high'
  output_path: string
}

export interface PlanStep {
  step: number
  description: string
  action: string
  validation: string
  risk: 'low' | 'medium' | 'high'
}

/** CLI arguments shared across all three scripts */
export interface BaseCliArgs {
  taskDescription: string
  taskId: string // Derived from taskDescription if not explicitly provided
  executionId: string // Always generated fresh per run
  ci: boolean // true when --ci flag is present or process.env.CI is set
}

export interface RunTaskArgs extends BaseCliArgs {
  dryRun: boolean
}

export interface PlanTaskArgs extends BaseCliArgs {
  outputPath: string // Defaults to docs/architecture/health/ai-plans/{task_id}.md
}

export interface ValidateArgs extends BaseCliArgs {
  // No additional fields beyond BaseCliArgs; --ci affects timeout budget
}

/**
 * INFRA-022 — Repository Hygiene Verification
 * Shared type definitions for all check modules.
 
 * @library-module
*/

export type TaskStatus = 'PASS' | 'FLAG' | 'WARNING' | 'SKIP' | 'INCONCLUSIVE'

export interface TaskFinding {
  item: string
  note: string
}

export interface TaskResult {
  taskId: string
  title: string
  status: TaskStatus
  summary: string
  findings: TaskFinding[]
  rawOutput?: string
}

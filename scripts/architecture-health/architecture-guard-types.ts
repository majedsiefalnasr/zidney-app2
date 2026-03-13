export type ValidationMode = 'development' | 'strict' | 'changed'
export type GuardVerdict = 'PASS' | 'BLOCKED'
export type GuardSeverity = 'error' | 'warning'

export interface ViolationLocation {
  file: string
  line?: number
  column?: number
}

export interface ViolationRecord {
  rule: string
  severity: GuardSeverity
  message: string
  location: ViolationLocation
  source_module: string
  target_module?: string
  remediation: string
}

export interface ScopeMetrics {
  modules_validated: number
  modules_skipped: number
  skipped_unmapped_files: string[]
}

export interface GuardRunReport {
  run_id: string
  timestamp: string
  validation_mode: ValidationMode
  scope: ScopeMetrics
  fallback_reason: string | null
  contract_error?: boolean
  verdict: GuardVerdict
  violations: ViolationRecord[]
  duration_ms: number
}

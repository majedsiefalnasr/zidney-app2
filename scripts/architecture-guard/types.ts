/** @library-module */
export type ValidationMode = 'development' | 'strict' | 'changed'

export type GuardVerdict = 'PASS' | 'BLOCKED'

export type GuardSeverity = 'error' | 'warning'

export type FallbackReason =
  | 'map_changed'
  | 'new_module_detected'
  | 'graph_missing'
  | 'graph_stale'
  | 'graph_unusable'
  | 'full_scope'
  | null

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
  fallback_reason: FallbackReason
  contract_error?: boolean
  verdict: GuardVerdict
  violations: ViolationRecord[]
  duration_ms: number
}

export interface RuleResult {
  rule: string
  violations: ViolationRecord[]
}

export interface RuleContext {
  repoRoot: string
  mode: ValidationMode
  allModules: string[]
  scopeModules: Set<string>
  changedFiles: string[]
  targetFiles: string[]
}

export interface GuardRule {
  id: string
  order: number
  enabledIn: ValidationMode[]
  run: (context: RuleContext) => Promise<RuleResult>
}

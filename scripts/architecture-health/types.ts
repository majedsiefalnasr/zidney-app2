export type HealthVerdict = 'PASS' | 'BLOCKED'
export type HealthState = 'EXCELLENT' | 'HEALTHY' | 'WARNING' | 'CRITICAL'
export type HealthSignalStatus = 'PASS' | 'WARN' | 'FAIL'
export type HealthSignalId =
  | 'dependency_integrity'
  | 'layer_integrity'
  | 'circular_dependency_risk'
  | 'type_safety_governance'
  | 'architecture_drift'
  | 'intelligence_synchronization'

export type HealthFindingClassification = 'direct_rule_violation' | 'drift' | 'synchronization'
export type HealthFindingSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IntelligenceArtifactStatusKind = 'CURRENT' | 'STALE' | 'MISSING' | 'INVALID'
export type EnrichmentMode = 'none' | 'gitnexus_query' | 'gitnexus_impact'
export type OutputFormat = 'json' | 'markdown' | 'text'

export const SIGNAL_ORDER: HealthSignalId[] = [
  'dependency_integrity',
  'layer_integrity',
  'circular_dependency_risk',
  'type_safety_governance',
  'architecture_drift',
  'intelligence_synchronization',
]

export interface HealthFindingLocation {
  file: string
  line?: number
  column?: number
}

export interface HealthFinding {
  finding_id: string
  signal_ids: HealthSignalId[]
  classification: HealthFindingClassification
  severity: HealthFindingSeverity
  impacted_surface: string
  location?: HealthFindingLocation
  message: string
  remediation: string
  source_tools: string[]
}

export interface HealthSignalResult {
  signal_id: HealthSignalId
  weight: number
  status: HealthSignalStatus
  score_delta: number
  finding_count: number
  summary?: string
  sources: string[]
}

export interface HealthThresholdPolicy {
  policy_id: string
  minimum_passing_score: number
  weights: Record<HealthSignalId, number>
  hard_fail_conditions: string[]
  status_mapping: {
    excellent_minimum: number
    healthy_minimum: number
    warning_minimum: number
  }
}

export interface IntelligenceArtifactStatus {
  artifact_name: string
  path: string
  required: boolean
  exists: boolean
  status: IntelligenceArtifactStatusKind
  last_modified_at?: string
  validator?: string
}

export interface ArchitectureIntelligenceSnapshot {
  snapshot_id: string
  artifacts: IntelligenceArtifactStatus[]
  generated_at?: string
  validation_status: IntelligenceArtifactStatusKind
  validation_notes?: string
}

export interface SourceRun {
  tool: string
  command: string
  enrichment_mode?: EnrichmentMode
  timeout_ms: number
  duration_ms: number
  timed_out: boolean
  started_at: string
  finished_at: string
  exit_code: number
  output_format: OutputFormat
  consumed_artifacts?: string[]
}

export interface ArchitectureHealthAssessment {
  schema_version: string
  assessment_id: string
  generated_at: string
  overall: {
    score: number
    health_state: HealthState
    threshold: {
      policy_id: string
      minimum_passing_score: number
    }
    verdict: HealthVerdict
  }
  threshold_policy: HealthThresholdPolicy
  signals: HealthSignalResult[]
  findings: HealthFinding[]
  intelligence_snapshot: ArchitectureIntelligenceSnapshot
  source_runs: SourceRun[]
}

export interface ArchitectureHealthCliOptions {
  output: OutputFormat
  threshold?: number
  ci: boolean
  refreshContext: boolean
  failOnSync: boolean
}

export interface ArchitectureHealthArtifacts {
  jsonPath: string
  summaryPath: string
  driftPath: string
  historyPath?: string
}

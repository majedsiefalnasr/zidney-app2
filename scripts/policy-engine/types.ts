export interface PolicyContext {
  mode: 'full' | 'changed'
  changedFiles: string[]
  impactedModules: string[]
  workspaceRoot: string
  correlationId: string
  /** Populated by RULE_FIX_03_AUTO_FIX_ATTEMPT; REPO_CLEAN skips these paths */
  autoFixedPaths: string[]
}

export interface DeferralReport {
  ruleId: string
  reason: string
  followUpStage: string
}

export interface ArtifactSnapshot {
  timestamp: string
  baseRef: string
  trackedFiles: string[]
  untrackedFiles: string[]
  prohibitedPaths: string[]
  hashes?: Record<string, string>
}

export interface PolicyResult {
  ruleId: string
  domain: string
  /** true iff severity !== 'error' */
  passed: boolean
  severity: 'error' | 'warning'
  messages: string[]
  violatingPaths: string[]
  deferralReport?: DeferralReport
}

export interface PolicyRule {
  id: string
  domain: string
  severity: 'error' | 'warning'
  run(context: PolicyContext): Promise<PolicyResult>
}

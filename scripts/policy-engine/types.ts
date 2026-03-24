export interface PolicyContext {
  mode: 'full' | 'changed'
}

export interface PolicyResult {
  ruleId: string
  success: boolean
  severity: 'error' | 'warning'
  message?: string
}

export interface PolicyRule {
  id: string
  run(context: PolicyContext): Promise<PolicyResult>
}

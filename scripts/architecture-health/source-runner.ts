import { spawn } from 'node:child_process'
import type { OutputFormat, SourceRun } from './types'

export type GovernanceTool =
  | 'arch_guard_ci'
  | 'infra_audit_quick'
  | 'type_safety_guard_json'
  | 'arch_validate_brain'
  | 'ai_context_refresh'
  | 'gitnexus_query'
  | 'gitnexus_impact'

export interface GovernanceCommandSpec {
  tool: GovernanceTool | string
  executable: string
  args: string[]
  timeout_ms: number
  output_format: OutputFormat
  enrichment_mode?: SourceRun['enrichment_mode']
}

export interface GovernanceCommandResult {
  sourceRun: SourceRun
  stdout: string
  stderr: string
}

const BUN = process.execPath

export const ALLOWED_COMMANDS: Record<GovernanceTool, GovernanceCommandSpec> = {
  arch_guard_ci: {
    tool: 'arch_guard_ci',
    executable: BUN,
    args: ['scripts/architecture-guard/architecture-guard.ts', '--ci', '--output', 'json'],
    timeout_ms: 30_000,
    output_format: 'json',
  },
  infra_audit_quick: {
    tool: 'infra_audit_quick',
    executable: BUN,
    args: ['scripts/infra-audit.ts', '--quick'],
    timeout_ms: 60_000,
    output_format: 'text',
  },
  type_safety_guard_json: {
    tool: 'type_safety_guard_json',
    executable: BUN,
    args: ['scripts/type-safety-guard.ts', '--json', '--no-exit-error'],
    timeout_ms: 30_000,
    output_format: 'json',
  },
  arch_validate_brain: {
    tool: 'arch_validate_brain',
    executable: BUN,
    args: ['scripts/validate-architecture-brain.ts'],
    timeout_ms: 30_000,
    output_format: 'text',
  },
  ai_context_refresh: {
    tool: 'ai_context_refresh',
    executable: BUN,
    args: ['scripts/generate-ai-context.ts', '--force'],
    timeout_ms: 90_000,
    output_format: 'text',
  },
  gitnexus_query: {
    tool: 'gitnexus_query',
    executable: 'gitnexus',
    args: ['query'],
    timeout_ms: 15_000,
    output_format: 'text',
    enrichment_mode: 'gitnexus_query',
  },
  gitnexus_impact: {
    tool: 'gitnexus_impact',
    executable: 'gitnexus',
    args: ['impact'],
    timeout_ms: 15_000,
    output_format: 'text',
    enrichment_mode: 'gitnexus_impact',
  },
}

export function resolveGovernanceCommand(tool: GovernanceTool): GovernanceCommandSpec {
  return ALLOWED_COMMANDS[tool]
}

export function buildCommandString(spec: GovernanceCommandSpec): string {
  return [spec.executable, ...spec.args].join(' ')
}

export async function runCommandSpec(
  spec: GovernanceCommandSpec,
  cwd = process.cwd()
): Promise<GovernanceCommandResult> {
  const startedAt = new Date()

  return await new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const child = spawn(spec.executable, spec.args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timeoutHandle = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, spec.timeout_ms)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', (error) => {
      clearTimeout(timeoutHandle)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timeoutHandle)
      const finishedAt = new Date()

      resolve({
        sourceRun: {
          tool: spec.tool,
          command: buildCommandString(spec),
          enrichment_mode: spec.enrichment_mode,
          timeout_ms: spec.timeout_ms,
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
          timed_out: timedOut,
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          exit_code: code ?? (timedOut ? 124 : 1),
          output_format: spec.output_format,
        },
        stdout,
        stderr,
      })
    })
  })
}

export async function runGovernanceCommand(
  tool: GovernanceTool,
  cwd = process.cwd()
): Promise<GovernanceCommandResult> {
  return runCommandSpec(resolveGovernanceCommand(tool), cwd)
}

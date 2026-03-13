import { describe, expect, it } from 'vitest'
import {
  buildCommandString,
  resolveGovernanceCommand,
  runCommandSpec,
} from '../../../scripts/architecture-health/source-runner'

describe('architecture-health source runner', () => {
  it('resolves allowlisted governance commands deterministically', () => {
    const spec = resolveGovernanceCommand('infra_audit_quick')
    expect(buildCommandString(spec)).toContain('scripts/infra-audit.ts --quick')
    expect(spec.timeout_ms).toBeGreaterThan(0)
  })

  it('captures successful command execution metadata', async () => {
    const result = await runCommandSpec(
      {
        tool: 'test-success',
        executable: process.execPath,
        args: ['-e', 'console.log("ok")'],
        timeout_ms: 1_000,
        output_format: 'text',
      },
      process.cwd()
    )

    expect(result.sourceRun.exit_code).toBe(0)
    expect(result.sourceRun.timed_out).toBe(false)
    expect(result.stdout.trim()).toBe('ok')
  })

  it('marks timed out commands explicitly', async () => {
    const result = await runCommandSpec(
      {
        tool: 'test-timeout',
        executable: process.execPath,
        args: ['-e', 'setTimeout(() => console.log("late"), 50)'],
        timeout_ms: 10,
        output_format: 'text',
      },
      process.cwd()
    )

    expect(result.sourceRun.timed_out).toBe(true)
    expect(result.sourceRun.exit_code).toBe(124)
  })
})

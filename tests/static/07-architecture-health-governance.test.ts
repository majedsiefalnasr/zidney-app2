import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const PACKAGE_JSON = join(ROOT, 'package.json')
const WORKFLOW = join(ROOT, '.github/workflows/architecture-governance.yml')
const README = join(ROOT, 'docs/architecture/health/README.md')
const CLI = join(ROOT, 'scripts/architecture-health/architecture-health.ts')
const QUICKSTART = join(
  ROOT,
  'specs/runtime/infra-015-autonomous-architecture-health/quickstart.md'
)

describe('architecture health governance static coverage', () => {
  it('registers immutable architecture-health scripts in package.json', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts['arch:health']).toBe(
      'bun scripts/architecture-health/architecture-health.ts'
    )
    expect(pkg.scripts['arch:health:ci']).toBe(
      'bun scripts/architecture-health/architecture-health.ts --ci'
    )
  })

  it('runs architecture health in CI with nightly schedule and artifact publication', () => {
    const workflow = readFileSync(WORKFLOW, 'utf-8')
    expect(workflow).toContain('schedule:')
    expect(workflow).toContain('cron:')
    expect(workflow).toContain('bun run arch:health:ci')
    expect(workflow).toContain('actions/upload-artifact@v4')
  })

  it('documents immutable threshold semantics, nightly monitoring, and performance budgets', () => {
    const readme = readFileSync(README, 'utf-8')
    expect(readme).toContain('immutable')
    expect(readme).toContain('nightly')
    expect(readme).toContain('artifact')
    expect(readme).toContain('p95')
    expect(readme).toContain('20')
  })

  it('emits structured completion logs with source-run metrics', () => {
    const cli = readFileSync(CLI, 'utf-8')
    expect(cli).toContain('architecture-health.completed')
    expect(cli).toContain('source_runs')
    expect(cli).toContain('duration_ms')
  })

  it('keeps generated artifact expectations and remediation guidance aligned with the quickstart', () => {
    const quickstart = readFileSync(QUICKSTART, 'utf-8')
    expect(quickstart).toContain('architecture-health.json')
    expect(quickstart).toContain('architecture-health-summary.md')
    expect(quickstart).toContain('architecture-drift-report.md')
    expect(quickstart).toContain('gitnexus query')
    expect(quickstart).toContain('gitnexus impact')
    expect(quickstart).toContain('stale or unavailable')
  })
})

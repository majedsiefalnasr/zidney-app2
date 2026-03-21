/**
 * @script ci:run-local
 * @domain ci
 * @description Local CI governance orchestrator — runs the 7-step pre-closure validation
 *              sequence including all governance checks and the full act CI simulation.
 *              Step 0 is a Docker fail-fast check; Steps 1–7 are governance checks that
 *              run to completion regardless of individual failures (fail-forward).
 * @category dev
 * @usage bun run ci:run-local
 */

import { spawnSync } from 'node:child_process'

interface StepResult {
  step: number
  name: string
  command: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  durationMs: number
  output: string
}

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'

function run(command: string, args: string[]): { success: boolean; output: string } {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const output = [stdout, stderr].filter(Boolean).join('\n').trim()
  const success = result.status === 0 && result.error == null

  return { success, output }
}

function runBunScript(scriptKey: string): { success: boolean; output: string } {
  return run('bun', ['run', scriptKey])
}

function checkDocker(): { running: boolean; message: string } {
  const result = run('docker', ['info', '--format', 'Docker Engine {{.ServerVersion}}'])
  return {
    running: result.success,
    message: result.success ? result.output.split('\n')[0] : result.output,
  }
}

const STEPS: Array<{ name: string; scriptKey: string }> = [
  { name: 'validate-runtime-scripts', scriptKey: 'validate-runtime-scripts' },
  { name: 'validate:scripts-infra', scriptKey: 'validate:scripts-infra' },
  { name: 'generate-script-docs', scriptKey: 'generate-script-docs' },
  { name: 'arch:guard', scriptKey: 'arch:guard' },
  { name: 'type-safety-guard', scriptKey: 'type-safety-guard' },
  { name: 'lint', scriptKey: 'lint' },
  { name: 'ci:local', scriptKey: 'ci:local' },
]

function printSeparator(): void {
  console.log('─'.repeat(70))
}

function main(): void {
  console.log()
  printSeparator()
  console.log(`${BOLD}${CYAN}  Zidney Local CI Orchestrator${RESET}`)
  console.log(`  7-step governance sequence + Docker fail-fast check`)
  printSeparator()
  console.log()

  // ── Step 0: Docker fail-fast check ────────────────────────────────────
  process.stdout.write(`${BOLD}[STEP 0/7]${RESET} Docker availability check ... `)
  const docker = checkDocker()
  if (!docker.running) {
    console.log(`${RED}FAIL${RESET}`)
    console.log()
    console.error(`${RED}${BOLD}ABORT: Docker is not running.${RESET}`)
    console.error(`  ${docker.message}`)
    console.error(`  Start Docker Desktop and retry.`)
    console.log()
    process.exit(1)
  }
  console.log(`${GREEN}PASS${RESET} (${docker.message})`)
  console.log()

  // ── Steps 1–7: Governance sequence (fail-forward) ─────────────────────
  const results: StepResult[] = []

  for (let i = 0; i < STEPS.length; i++) {
    const stepNum = i + 1
    const { name, scriptKey } = STEPS[i]

    process.stdout.write(`${BOLD}[STEP ${stepNum}/7]${RESET} ${name} ... `)

    const start = Date.now()
    const { success, output } = runBunScript(scriptKey)
    const durationMs = Date.now() - start

    const status: 'PASS' | 'FAIL' = success ? 'PASS' : 'FAIL'
    const color = success ? GREEN : RED

    console.log(`${color}${status}${RESET} ${YELLOW}(${durationMs}ms)${RESET}`)

    if (!success && output) {
      console.log()
      console.log(`  ${BOLD}Output from failed step [${stepNum}/${STEPS.length}] ${name}:${RESET}`)
      const indented = output
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n')
      console.log(indented)
      console.log()
    }

    results.push({
      step: stepNum,
      name,
      command: `bun run ${scriptKey}`,
      status,
      durationMs,
      output,
    })
  }

  // ── Final summary table ───────────────────────────────────────────────
  console.log()
  printSeparator()
  console.log(`${BOLD}  Step Summary${RESET}`)
  printSeparator()

  const colW = { step: 10, name: 32, status: 8, duration: 12 }
  const header = [
    'Step'.padEnd(colW.step),
    'Name'.padEnd(colW.name),
    'Status'.padEnd(colW.status),
    'Duration'.padEnd(colW.duration),
  ].join('  ')
  console.log(`  ${BOLD}${header}${RESET}`)
  console.log(`  ${'─'.repeat(colW.step + colW.name + colW.status + colW.duration + 6)}`)

  for (const r of results) {
    const statusColor = r.status === 'PASS' ? GREEN : RED
    const row = [
      `${r.step}/7`.padEnd(colW.step),
      r.name.padEnd(colW.name),
      `${statusColor}${r.status}${RESET}`.padEnd(colW.status + statusColor.length + RESET.length),
      `${r.durationMs}ms`.padEnd(colW.duration),
    ].join('  ')
    console.log(`  ${row}`)
  }

  printSeparator()

  const failedSteps = results.filter((r) => r.status === 'FAIL')
  const allPassed = failedSteps.length === 0

  if (allPassed) {
    console.log()
    console.log(`${GREEN}${BOLD}  ✓ All 7 steps passed. Local CI simulation complete.${RESET}`)
    console.log()
    process.exit(0)
  } else {
    console.log()
    console.log(`${RED}${BOLD}  ✗ ${failedSteps.length} step(s) failed:${RESET}`)
    for (const r of failedSteps) {
      console.log(`    • [Step ${r.step}/7] ${r.name}  →  ${r.command}`)
    }
    console.log()
    process.exit(1)
  }
}

main()

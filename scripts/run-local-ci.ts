#!/usr/bin/env bun

/**
 * @script ci:run-local
 * @domain ci
 * @description Local CI governance orchestrator — runs the 7-step pre-closure validation
 *              sequence, then writes a detailed markdown report into the active spec runtime
 *              directory when available, or docs/reports otherwise.
 * @category dev
 * @usage bun run ci:run-local
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { exit, flushAi, getPassthroughFlags, hasCiFlag, log } from './utils/logger'

log.setScript('ci:run-local')
const isCi = hasCiFlag()

const ROOT_COMMAND = 'bun run ci:run-local'
const ROOT_DIR = process.cwd()
const REPORT_TEMPLATE_PATH = join(ROOT_DIR, 'specs/templates/reports/local-ci-report-template.md')
const FALLBACK_REPORT_PATH = join(ROOT_DIR, 'docs/reports/LOCAL_CI_REPORT.md')

interface StepResult {
  step: number
  name: string
  command: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  durationMs: number
  output: string
  summary: string
}

interface StepDefinition {
  name: string
  scriptKey: string
  ciArgs?: string[]
}

interface RuntimeStageContext {
  currentStageDir: string
  currentStageName: string
  runtimeStagePath: string
  reportPath: string
  reportLocation: string
  runtimeStageResolved: boolean
  resolutionSource: 'git-branch' | 'fallback'
}

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const _CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const TOTAL_CHECKS = 7

const DEFAULT_REPORT_TEMPLATE = `# Local CI Report

**Command:** <ROOT_COMMAND>  
**Timestamp:** <REPORT_GENERATED_AT>  
**Status:** <OVERALL_STATUS>  
**Exit Code:** <EXIT_CODE>  
**Report Location:** <REPORT_LOCATION>  

<!-- LOCAL_CI_REPORT_METADATA_START
{
  "overall_status": "<OVERALL_STATUS>",
  "exit_code": <EXIT_CODE>,
  "current_stage_dir": "<CURRENT_STAGE_DIR>",
  "current_stage_name": "<CURRENT_STAGE_NAME>",
  "report_generated_at": "<REPORT_GENERATED_AT>",
  "failed_step_names": <FAILED_STEP_NAMES_JSON>,
  "report_location": "<REPORT_LOCATION>",
  "runtime_stage_resolved": <RUNTIME_STAGE_RESOLVED>,
  "closure_gate_status": "<CLOSURE_GATE_STATUS>",
  "ready_for_closure": <READY_FOR_CLOSURE>
}
LOCAL_CI_REPORT_METADATA_END -->

---

## Summary

<SUMMARY_TEXT>

---

## Resolved Stage / Runtime Context

| Field | Value |
| --- | --- |
| Current stage directory | <CURRENT_STAGE_DIR> |
| Current stage name | <CURRENT_STAGE_NAME> |
| Runtime stage resolved | <RUNTIME_STAGE_RESOLVED_LABEL> |
| Resolved runtime path | <RESOLVED_RUNTIME_STAGE_PATH> |
| Resolution source | <RUNTIME_RESOLUTION_SOURCE> |
| Destination rule | \`specs/runtime/<STAGE_DIR_NAME>/reports/LOCAL_CI_REPORT.md\` when a current runtime stage is resolved; otherwise \`docs/reports/LOCAL_CI_REPORT.md\` |
| Resolved report location | <REPORT_LOCATION> |

---

## Docker Check

| Check | Command | Status | Duration | Notes |
| --- | --- | --- | --- | --- |
| Docker availability | <DOCKER_CHECK_COMMAND> | <DOCKER_CHECK_STATUS> | <DOCKER_CHECK_DURATION> | <DOCKER_CHECK_RESULT> |

---

## Step Summary

| Step Number | Script Name | Command | Status | Duration |
| --- | --- | --- | --- | --- |
<STEP_SUMMARY_ROWS>

---

## Failed Steps

| Step Number | Script Name | Command | Failure Summary |
| --- | --- | --- | --- |
<FAILED_STEP_ROWS>

**Failed Step Names:** <FAILED_STEP_NAMES_LABEL>  
**Failed Step Count:** <FAILED_STEP_COUNT>  

---

## Detailed Failure Output

<DETAILED_FAILURE_OUTPUT>

---

## Workflow Guidance / Next Actions

1. If \`<OVERALL_STATUS>\` is \`PASS\` and \`<CLOSURE_GATE_STATUS>\` is \`PASS\`, proceed with the orchestrator closure flow and preserve this report at \`<REPORT_LOCATION>\`.
2. If any step failed, fix the blocking scripts or workflow jobs listed above, rerun \`<ROOT_COMMAND>\`, and replace this report with the latest results.
3. If no current runtime stage could be resolved, keep this report under \`docs/reports/LOCAL_CI_REPORT.md\` until stage context is established.
4. If Docker failed before the workflow ran, start Docker, rerun the local CI command, and confirm the step summary is fully regenerated.

---

## Closure Gate Summary

| Gate Field | Value |
| --- | --- |
| Closure Gate Status | <CLOSURE_GATE_STATUS> |
| Ready for Orchestrator Closure | <READY_FOR_CLOSURE_LABEL> |
| Overall Local CI Status | <OVERALL_STATUS> |
| Exit Code | <EXIT_CODE> |
| Failed Step Names | <FAILED_STEP_NAMES_LABEL> |
| Required Action | <CLOSURE_GATE_ACTION> |

---

## Next Step

Use this report as the pre-closure validation artifact for the orchestrator. Proceed only when the closure gate is \`PASS\`.
`

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

function getBunRunArgs(step: StepDefinition): string[] {
  const passthrough = getPassthroughFlags()
  // Merge step-specific ciArgs with the active passthrough flags, deduplicated
  const merged = Array.from(new Set([...(isCi ? (step.ciArgs ?? []) : []), ...passthrough]))
  return merged.length > 0 ? ['run', step.scriptKey, '--', ...merged] : ['run', step.scriptKey]
}

function formatBunCommand(step: StepDefinition): string {
  return `bun ${getBunRunArgs(step).join(' ')}`
}

function runBunScript(step: StepDefinition): { success: boolean; output: string } {
  return run('bun', getBunRunArgs(step))
}

function checkDocker(): { running: boolean; message: string } {
  const result = run('docker', ['info', '--format', 'Docker Engine {{.ServerVersion}}'])
  return {
    running: result.success,
    message: result.success ? result.output.split('\n')[0] : result.output,
  }
}

function formatDuration(durationMs: number): string {
  return `${durationMs}ms`
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br />').trim() || '—'
}

function escapeFenceContent(value: string): string {
  return value.replace(/~~~/g, '~~ ~')
}

function extractFailureSummary(output: string): string {
  const firstContentLine = output
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstContentLine) {
    return 'No output captured'
  }

  return firstContentLine.length > 180
    ? `${firstContentLine.slice(0, 177).trimEnd()}...`
    : firstContentLine
}

function loadWorkflowState(stageDirName: string): { stage?: string } | null {
  const workflowStatePath = join(ROOT_DIR, 'specs/runtime', stageDirName, '.workflow-state.json')
  if (!existsSync(workflowStatePath)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(workflowStatePath, 'utf-8')) as { stage?: string }
  } catch {
    return null
  }
}

function buildRuntimeStageContext(
  stageDirName: string,
  resolutionSource: RuntimeStageContext['resolutionSource']
): RuntimeStageContext | null {
  const workflowState = loadWorkflowState(stageDirName)
  if (!workflowState) {
    return null
  }

  const runtimeStagePath = join(ROOT_DIR, 'specs/runtime', stageDirName)
  const reportPath = join(runtimeStagePath, 'reports', 'LOCAL_CI_REPORT.md')

  return {
    currentStageDir: relative(ROOT_DIR, runtimeStagePath),
    currentStageName: workflowState.stage ?? stageDirName,
    runtimeStagePath: relative(ROOT_DIR, runtimeStagePath),
    reportPath,
    reportLocation: relative(ROOT_DIR, reportPath),
    runtimeStageResolved: true,
    resolutionSource,
  }
}

function resolveStageFromBranch(): RuntimeStageContext | null {
  const branchResult = run('git', ['branch', '--show-current'])
  if (!branchResult.success) {
    return null
  }

  const branchName = branchResult.output.trim()
  if (!branchName.startsWith('spec/')) {
    return null
  }

  return buildRuntimeStageContext(branchName.slice('spec/'.length), 'git-branch')
}

function resolveCurrentStageContext(): RuntimeStageContext {
  return (
    resolveStageFromBranch() ?? {
      currentStageDir: 'Not resolved',
      currentStageName: 'Not resolved',
      runtimeStagePath: 'Not resolved',
      reportPath: FALLBACK_REPORT_PATH,
      reportLocation: relative(ROOT_DIR, FALLBACK_REPORT_PATH),
      runtimeStageResolved: false,
      resolutionSource: 'fallback',
    }
  )
}

function loadReportTemplate(): string {
  if (!existsSync(REPORT_TEMPLATE_PATH)) {
    return DEFAULT_REPORT_TEMPLATE
  }

  return readFileSync(REPORT_TEMPLATE_PATH, 'utf-8')
}

function renderLocalCiReport(
  results: StepResult[],
  exitCode: number,
  context: RuntimeStageContext
): string {
  const template = loadReportTemplate()
  const failedSteps = results.filter((result) => result.status === 'FAIL')
  const dockerStep = results[0]
  const overallStatus = exitCode === 0 ? 'PASS' : 'FAIL'
  const closureGateStatus = exitCode === 0 ? 'PASS' : 'BLOCKED'
  const readyForClosure = exitCode === 0
  const reportGeneratedAt = new Date().toISOString()
  const failedStepNames = failedSteps.map((result) => result.name)
  const failedStepNamesLabel = failedStepNames.length > 0 ? failedStepNames.join(', ') : 'None'

  const stepSummaryRows = results
    .map(
      (result) =>
        `| ${result.step} | ${escapeMarkdownCell(result.name)} | \`${escapeMarkdownCell(result.command)}\` | ${result.status} | ${formatDuration(result.durationMs)} |`
    )
    .join('\n')

  const failedStepRows =
    failedSteps.length > 0
      ? failedSteps
          .map(
            (result) =>
              `| ${result.step} | ${escapeMarkdownCell(result.name)} | \`${escapeMarkdownCell(result.command)}\` | ${escapeMarkdownCell(result.summary)} |`
          )
          .join('\n')
      : '| — | None | — | No blocking failures recorded |'

  const detailedFailureOutput =
    failedSteps.length > 0
      ? failedSteps
          .map((result) => {
            const output = result.output.trim() || 'No output captured'
            return [
              `### Step ${result.step} — ${result.name}`,
              '',
              `- Command: \`${result.command}\``,
              `- Duration: ${formatDuration(result.durationMs)}`,
              `- Summary: ${result.summary}`,
              '',
              '~~~text',
              escapeFenceContent(output),
              '~~~',
            ].join('\n')
          })
          .join('\n\n')
      : 'No blocking failures recorded.'

  const summaryText =
    overallStatus === 'PASS'
      ? 'All local CI checks passed. The closure gate is satisfied and this report can be used as the pre-closure validation artifact.'
      : 'Local CI failed. The closure gate is blocked until the listed failures are fixed and the command is rerun to regenerate this report.'

  const replacements: Record<string, string> = {
    '<ROOT_COMMAND>': ROOT_COMMAND,
    '<REPORT_GENERATED_AT>': reportGeneratedAt,
    '<OVERALL_STATUS>': overallStatus,
    '<EXIT_CODE>': String(exitCode),
    '<REPORT_LOCATION>': context.reportLocation,
    '<CURRENT_STAGE_DIR>': context.currentStageDir,
    '<CURRENT_STAGE_NAME>': context.currentStageName,
    '<FAILED_STEP_NAMES_JSON>': JSON.stringify(failedStepNames),
    '<RUNTIME_STAGE_RESOLVED>': String(context.runtimeStageResolved),
    '<RUNTIME_STAGE_RESOLVED_LABEL>': context.runtimeStageResolved ? 'Yes' : 'No',
    '<CLOSURE_GATE_STATUS>': closureGateStatus,
    '<READY_FOR_CLOSURE>': String(readyForClosure),
    '<READY_FOR_CLOSURE_LABEL>': readyForClosure ? 'Yes' : 'No',
    '<SUMMARY_TEXT>': summaryText,
    '<RESOLVED_RUNTIME_STAGE_PATH>': context.runtimeStagePath,
    '<RUNTIME_RESOLUTION_SOURCE>': context.resolutionSource,
    '<DOCKER_CHECK_COMMAND>':
      dockerStep?.command ?? 'docker info --format Docker Engine {{.ServerVersion}}',
    '<DOCKER_CHECK_STATUS>': dockerStep?.status ?? 'FAIL',
    '<DOCKER_CHECK_DURATION>': dockerStep ? formatDuration(dockerStep.durationMs) : '0ms',
    '<DOCKER_CHECK_RESULT>': dockerStep?.summary ?? 'Docker availability could not be determined',
    '<STEP_SUMMARY_ROWS>': stepSummaryRows,
    '<FAILED_STEP_ROWS>': failedStepRows,
    '<FAILED_STEP_NAMES_LABEL>': failedStepNamesLabel,
    '<FAILED_STEP_COUNT>': String(failedSteps.length),
    '<DETAILED_FAILURE_OUTPUT>': detailedFailureOutput,
    '<CLOSURE_GATE_ACTION>':
      overallStatus === 'PASS'
        ? 'Proceed with closure and reference this report in the stage artifacts.'
        : `Fix the failing steps (${failedStepNamesLabel}) and rerun ${ROOT_COMMAND}.`,
  }

  let report = template
  for (const [token, value] of Object.entries(replacements)) {
    report = report.split(token).join(value)
  }

  return report
}

function writeLocalCiReport(results: StepResult[], exitCode: number): RuntimeStageContext | null {
  try {
    const context = resolveCurrentStageContext()
    mkdirSync(dirname(context.reportPath), { recursive: true })
    writeFileSync(context.reportPath, renderLocalCiReport(results, exitCode, context), 'utf-8')
    return context
  } catch (error) {
    log.warn(
      `Unable to write Local CI report: ${error instanceof Error ? error.message : String(error)}`
    )
    return null
  }
}

const STEPS: StepDefinition[] = [
  { name: 'validate:scripts:all', scriptKey: 'validate:scripts:all', ciArgs: ['--ci'] },
  {
    name: 'dev:generate:script-docs',
    scriptKey: 'dev:generate:script-docs',
    ciArgs: ['--ci', '--check-only'],
  },
  { name: 'arch:guard', scriptKey: 'arch:guard', ciArgs: ['--ci', '--check-only'] },
  { name: 'arch:type-safety-guard', scriptKey: 'arch:type-safety-guard', ciArgs: ['--ci'] },
  { name: 'lint', scriptKey: 'lint' },
  { name: 'ci:local', scriptKey: 'ci:local' },
]

function printSeparator(): void {
  log.info('─'.repeat(70))
}

function main(): void {
  log.header('ZIDNEY LOCAL CI ORCHESTRATOR', '7-step governance sequence + Docker fail-fast check')
  if (isCi) {
    log.info('[ci:run-local] CI mode enabled for CI-aware steps')
  }

  // ── Step 0: Docker fail-fast check ────────────────────────────────────
  const results: StepResult[] = []

  process.stdout.write(`${BOLD}[STEP 0/${TOTAL_CHECKS}]${RESET} Docker availability check ... `)
  const dockerStart = Date.now()
  const docker = checkDocker()
  const dockerDurationMs = Date.now() - dockerStart
  results.push({
    step: 0,
    name: 'docker:availability',
    command: 'docker info --format Docker Engine {{.ServerVersion}}',
    status: docker.running ? 'PASS' : 'FAIL',
    durationMs: dockerDurationMs,
    output: docker.message,
    summary: docker.message || 'No output captured',
  })

  if (!docker.running) {
    const reportContext = writeLocalCiReport(results, 1)
    log.error(`${RED}FAIL${RESET}`)
    log.error(`ABORT: Docker is not running. ${docker.message}`)
    if (reportContext) {
      log.info(`Report written to ${reportContext.reportLocation}`)
    }
    log.error('Start Docker Desktop and retry.')
    log.result({ total: TOTAL_CHECKS, passed: 0, failed: 1 })
    flushAi()
    exit(1)
  }
  log.success(`Docker available: ${docker.message}`)

  // ── Steps 1–7: Governance sequence (fail-forward) ─────────────────────
  for (let i = 0; i < STEPS.length; i++) {
    const stepNum = i + 1
    const step = STEPS[i]
    const { name } = step

    process.stdout.write(`${BOLD}[STEP ${stepNum}/${TOTAL_CHECKS}]${RESET} ${name} ... `)

    const start = Date.now()
    const { success, output } = runBunScript(step)
    const durationMs = Date.now() - start

    const status: 'PASS' | 'FAIL' = success ? 'PASS' : 'FAIL'
    const color = success ? GREEN : RED

    log.info(`${color}${status}${RESET} ${YELLOW}(${durationMs}ms)${RESET}`)

    if (!success && output) {
      log.info('')
      log.info(`  ${BOLD}Output from failed step [${stepNum}/${TOTAL_CHECKS}] ${name}:${RESET}`)
      const indented = output
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n')
      log.info(indented)
      log.info('')
    }

    results.push({
      step: stepNum,
      name,
      command: formatBunCommand(step),
      status,
      durationMs,
      output,
      summary: success ? 'Completed successfully' : extractFailureSummary(output),
    })
  }

  const reportContext = writeLocalCiReport(
    results,
    results.some((result) => result.status === 'FAIL') ? 1 : 0
  )

  // ── Final summary table ───────────────────────────────────────────────
  log.info('')
  printSeparator()
  log.info(`${BOLD}  Step Summary${RESET}`)
  printSeparator()

  const colW = { step: 10, name: 32, status: 8, duration: 12 }
  const header = [
    'Step'.padEnd(colW.step),
    'Name'.padEnd(colW.name),
    'Status'.padEnd(colW.status),
    'Duration'.padEnd(colW.duration),
  ].join('  ')
  log.info(`  ${BOLD}${header}${RESET}`)
  log.info(`  ${'─'.repeat(colW.step + colW.name + colW.status + colW.duration + 6)}`)

  for (const r of results) {
    const statusColor = r.status === 'PASS' ? GREEN : RED
    const row = [
      `${r.step}/${TOTAL_CHECKS}`.padEnd(colW.step),
      r.name.padEnd(colW.name),
      `${statusColor}${r.status}${RESET}`.padEnd(colW.status + statusColor.length + RESET.length),
      `${r.durationMs}ms`.padEnd(colW.duration),
    ].join('  ')
    log.info(`  ${row}`)
  }

  printSeparator()

  const failedSteps = results.filter((r) => r.status === 'FAIL')
  const allPassed = failedSteps.length === 0

  if (allPassed) {
    log.info('')
    log.success(`All 7 steps passed. Local CI simulation complete.`)
    if (reportContext) {
      log.info(`Report written to ${reportContext.reportLocation}`)
    }
    log.info('')
    log.result({ total: TOTAL_CHECKS, passed: TOTAL_CHECKS, failed: 0 })
    exit(0)
  } else {
    log.info('')
    log.error(`${failedSteps.length} step(s) failed:`)
    for (const r of failedSteps) {
      log.error(`  • [Step ${r.step}/${TOTAL_CHECKS}] ${r.name}  →  ${r.command}`)
    }
    if (reportContext) {
      log.info(`Report written to ${reportContext.reportLocation}`)
    }
    log.info('')
    log.result({
      total: TOTAL_CHECKS,
      passed: results.filter((r) => r.status === 'PASS').length,
      failed: failedSteps.length,
    })
    exit(1)
  }
}

main()

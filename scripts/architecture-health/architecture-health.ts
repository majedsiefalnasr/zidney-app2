#!/usr/bin/env bun

import { createHash } from 'node:crypto'
import {
  normalizeBaselineGovernance,
  parseGuardRunReport,
  parseInfraAuditQuickSummary,
} from './collectors/baseline-governance'
import {
  normalizeValidationGovernance,
  parseTypeSafetyGuardReport,
} from './collectors/validation-governance'
import { normalizeFindings } from './finding-normalizer'
import {
  formatAssessmentAsJson,
  formatAssessmentAsMarkdown,
  formatAssessmentAsText,
} from './formatters'
import {
  buildGitNexusEnrichmentPlan,
  createGitNexusExecutionFinding,
  createGitNexusUnavailableFinding,
} from './gitnexus-enrichment'
import {
  createRefreshResolutionFinding,
  inspectArchitectureIntelligence,
} from './intelligence-snapshot'
import { validateArchitectureHealthReport } from './report-schema'
import { writeAssessmentArtifacts } from './report-writer'
import {
  createDefaultSignals,
  DEFAULT_THRESHOLD_POLICY,
  evaluateHealthSignals,
} from './score-model'
import { runCommandSpec, runGovernanceCommand } from './source-runner'
import type {
  ArchitectureHealthAssessment,
  ArchitectureHealthCliOptions,
  ArchitectureIntelligenceSnapshot,
  HealthFinding,
  HealthSignalResult,
  SourceRun,
} from './types'
import { SIGNAL_ORDER } from './types'

export function parseCliArgs(args = process.argv.slice(2)): ArchitectureHealthCliOptions {
  const thresholdIndex = args.indexOf('--threshold')
  const thresholdValue = thresholdIndex >= 0 ? Number(args[thresholdIndex + 1]) : undefined

  return {
    output: args.includes('--output')
      ? ((args[args.indexOf('--output') + 1] ?? 'text') as ArchitectureHealthCliOptions['output'])
      : 'text',
    threshold: Number.isFinite(thresholdValue) ? thresholdValue : undefined,
    ci: args.includes('--ci'),
    refreshContext: args.includes('--refresh-context'),
    failOnSync: args.includes('--fail-on-sync'),
  }
}

function upsertSignal(
  signals: HealthSignalResult[],
  signal: HealthSignalResult
): HealthSignalResult[] {
  return signals
    .filter((existing) => existing.signal_id !== signal.signal_id)
    .concat(signal)
    .sort(
      (left, right) => SIGNAL_ORDER.indexOf(left.signal_id) - SIGNAL_ORDER.indexOf(right.signal_id)
    )
}

function createAssessmentId(signals: HealthSignalResult[], findings: HealthFinding[]): string {
  const hash = createHash('sha1')
  hash.update(JSON.stringify({ signals, findings }))
  return hash.digest('hex')
}

export function buildAssessmentFromCollections(input: {
  repoRoot: string
  signals: HealthSignalResult[]
  findings: HealthFinding[]
  intelligenceSnapshot: ArchitectureIntelligenceSnapshot
  sourceRuns: SourceRun[]
  threshold?: number
  ci: boolean
  failOnSync: boolean
}): ArchitectureHealthAssessment {
  const generatedAt = new Date().toISOString()
  const policy = {
    ...DEFAULT_THRESHOLD_POLICY,
    minimum_passing_score:
      input.ci || input.threshold === undefined
        ? DEFAULT_THRESHOLD_POLICY.minimum_passing_score
        : input.threshold,
  }

  const intelligenceSignal = input.signals.find(
    (signal) => signal.signal_id === 'intelligence_synchronization'
  )
  const hardFailTriggered =
    input.failOnSync && input.intelligenceSnapshot.validation_status !== 'CURRENT'

  const overall = evaluateHealthSignals(
    input.signals,
    policy,
    hardFailTriggered ||
      input.sourceRuns.some((run) => run.tool === 'arch_validate_brain' && run.exit_code !== 0)
  )

  return {
    schema_version: '1.0.0',
    assessment_id: createAssessmentId(input.signals, input.findings),
    generated_at: generatedAt,
    overall: {
      score: overall.score,
      health_state: overall.health_state,
      threshold: {
        policy_id: policy.policy_id,
        minimum_passing_score: policy.minimum_passing_score,
      },
      verdict:
        intelligenceSignal?.status === 'FAIL' && input.failOnSync ? 'BLOCKED' : overall.verdict,
    },
    threshold_policy: policy,
    signals: input.signals,
    findings: input.findings,
    intelligence_snapshot: input.intelligenceSnapshot,
    source_runs: input.sourceRuns,
  }
}

async function collectAssessment(
  repoRoot: string,
  options: ArchitectureHealthCliOptions
): Promise<ArchitectureHealthAssessment> {
  const [guardRun, infraRun, typeSafetyRun, brainRun] = await Promise.all([
    runGovernanceCommand('arch_guard_ci', repoRoot),
    runGovernanceCommand('infra_audit_quick', repoRoot),
    runGovernanceCommand('type_safety_guard_json', repoRoot),
    runGovernanceCommand('arch_validate_brain', repoRoot),
  ])

  const baseline = normalizeBaselineGovernance({
    guardReport: parseGuardRunReport(guardRun.stdout),
    infraSummary: parseInfraAuditQuickSummary(infraRun.stdout),
  })
  const validation = normalizeValidationGovernance({
    typeSafetyReport: parseTypeSafetyGuardReport(typeSafetyRun.stdout),
    brainValidationRun: brainRun.sourceRun,
  })
  const initialInspection = inspectArchitectureIntelligence(repoRoot)
  let snapshot = initialInspection.snapshot
  const snapshotFindings = [...initialInspection.findings]

  let signals = createDefaultSignals()
  for (const signal of baseline.signals) signals = upsertSignal(signals, signal)
  signals = upsertSignal(signals, validation.signal)
  signals = upsertSignal(signals, {
    signal_id: 'intelligence_synchronization',
    weight: DEFAULT_THRESHOLD_POLICY.weights.intelligence_synchronization,
    status: snapshot.validation_status === 'CURRENT' ? 'PASS' : 'FAIL',
    score_delta:
      snapshot.validation_status === 'CURRENT'
        ? 0
        : DEFAULT_THRESHOLD_POLICY.weights.intelligence_synchronization,
    finding_count: snapshotFindings.length,
    summary: snapshot.validation_notes,
    sources: ['docs/ai/context', 'arch:validate-brain'],
  })

  const sourceRuns: SourceRun[] = [
    guardRun.sourceRun,
    infraRun.sourceRun,
    typeSafetyRun.sourceRun,
    brainRun.sourceRun,
  ]

  const findings = normalizeFindings([
    ...baseline.findings,
    ...validation.findings,
    ...snapshotFindings,
  ])

  if (options.refreshContext && snapshot.validation_status !== 'CURRENT') {
    const refreshRun = await runGovernanceCommand('ai_context_refresh', repoRoot)
    sourceRuns.push(refreshRun.sourceRun)

    const postRefreshBrainRun = await runGovernanceCommand('arch_validate_brain', repoRoot)
    sourceRuns.push(postRefreshBrainRun.sourceRun)

    const postRefreshInspection = inspectArchitectureIntelligence(repoRoot)
    findings.push(
      createRefreshResolutionFinding(
        snapshot.validation_status,
        postRefreshInspection.snapshot.validation_status
      )
    )
    snapshot = postRefreshInspection.snapshot
  }

  try {
    const enrichmentPlan = buildGitNexusEnrichmentPlan(
      'architecture health governance drift',
      'scripts/architecture-health/architecture-health.ts'
    )
    const [gitnexusQueryRun, gitnexusImpactRun] = await Promise.all([
      runCommandSpec(enrichmentPlan.query, repoRoot),
      runCommandSpec(enrichmentPlan.impact, repoRoot),
    ])
    sourceRuns.push(gitnexusQueryRun.sourceRun, gitnexusImpactRun.sourceRun)

    if (gitnexusQueryRun.sourceRun.exit_code !== 0) {
      findings.push(
        createGitNexusExecutionFinding('query', gitnexusQueryRun.stderr || gitnexusQueryRun.stdout)
      )
    }

    if (gitnexusImpactRun.sourceRun.exit_code !== 0) {
      findings.push(
        createGitNexusExecutionFinding(
          'impact',
          gitnexusImpactRun.stderr || gitnexusImpactRun.stdout
        )
      )
    }
  } catch {
    findings.push(createGitNexusUnavailableFinding('command unavailable or index not ready'))
  }

  const driftSignal = signals.find((signal) => signal.signal_id === 'architecture_drift')
  const gitnexusFindingCount = findings.filter((finding) =>
    finding.source_tools.includes('gitnexus')
  ).length
  if (driftSignal && gitnexusFindingCount > 0) {
    driftSignal.status = driftSignal.status === 'FAIL' ? 'FAIL' : 'WARN'
    driftSignal.finding_count += gitnexusFindingCount
    driftSignal.score_delta = Math.min(
      driftSignal.weight,
      driftSignal.score_delta + gitnexusFindingCount * 2
    )
    driftSignal.summary = `${driftSignal.summary}; GitNexus enrichment findings: ${gitnexusFindingCount}`
  }

  return buildAssessmentFromCollections({
    repoRoot,
    signals,
    findings,
    intelligenceSnapshot: snapshot,
    sourceRuns,
    threshold: options.threshold,
    ci: options.ci,
    failOnSync: options.failOnSync,
  })
}

function renderOutput(
  assessment: ArchitectureHealthAssessment,
  output: ArchitectureHealthCliOptions['output']
): string {
  switch (output) {
    case 'json':
      return formatAssessmentAsJson(assessment)
    case 'markdown':
      return formatAssessmentAsMarkdown(assessment)
    default:
      return formatAssessmentAsText(assessment)
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs()
  const repoRoot = process.cwd()
  const assessment = await collectAssessment(repoRoot, options)

  const schemaValidation = validateArchitectureHealthReport(assessment)
  if (!schemaValidation.valid) {
    throw new Error(
      `Architecture health report validation failed: ${schemaValidation.errors.join('; ')}`
    )
  }

  if (options.output === 'json' || options.output === 'markdown' || options.output === 'text') {
    if (!process.argv.includes('--output')) {
      writeAssessmentArtifacts(repoRoot, assessment)
    }
  }

  process.stderr.write(
    `${JSON.stringify({
      event: 'architecture-health.completed',
      verdict: assessment.overall.verdict,
      score: assessment.overall.score,
      finding_count: assessment.findings.length,
      source_runs: assessment.source_runs.map((run) => ({
        tool: run.tool,
        duration_ms: run.duration_ms,
        timed_out: run.timed_out,
        exit_code: run.exit_code,
      })),
    })}\n`
  )

  process.stdout.write(renderOutput(assessment, options.output))
  process.exitCode = assessment.overall.verdict === 'PASS' ? 0 : 1
}

void main()

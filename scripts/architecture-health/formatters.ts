/** @library-module */
import type { ArchitectureHealthAssessment } from './types'

const HOME = process.env.HOME ?? ''
const REPO_ROOT = process.cwd()

function sanitizePaths(str: string): string {
  let result = str
  if (REPO_ROOT) result = result.replaceAll(REPO_ROOT, '<repo>')
  if (HOME) result = result.replaceAll(HOME, '<home>')
  // Also strip absolute node_modules paths
  result = result.replace(/\/[^"\s]*?\/node_modules\//g, '<home>/node_modules/')
  return result
}

export function formatAssessmentAsJson(assessment: ArchitectureHealthAssessment): string {
  return sanitizePaths(`${JSON.stringify(assessment, null, 2)}\n`)
}

export function formatAssessmentAsMarkdown(assessment: ArchitectureHealthAssessment): string {
  const findings = assessment.findings.length
    ? assessment.findings
        .map(
          (finding) =>
            `- **${finding.severity.toUpperCase()}** ${finding.impacted_surface}: ${finding.message}`
        )
        .join('\n')
    : '- No findings detected.'

  const output = [
    '# Architecture Health Summary',
    '',
    `- Score: ${assessment.overall.score}`,
    `- Health State: ${assessment.overall.health_state}`,
    `- Verdict: ${assessment.overall.verdict}`,
    `- Threshold: ${assessment.overall.threshold.minimum_passing_score}`,
    '',
    '## Findings',
    findings,
    '',
    '## Signals',
    ...assessment.signals.map(
      (signal) =>
        `- ${signal.signal_id}: ${signal.status} (${signal.finding_count} findings, delta ${signal.score_delta})`
    ),
    '',
  ].join('\n')
  return sanitizePaths(output)
}

export function formatAssessmentAsText(assessment: ArchitectureHealthAssessment): string {
  const output = [
    `Architecture Health Score: ${assessment.overall.score}`,
    `Health State: ${assessment.overall.health_state}`,
    `Verdict: ${assessment.overall.verdict}`,
    `Findings: ${assessment.findings.length}`,
  ].join('\n')
  return sanitizePaths(output)
}

export function formatDriftReportAsMarkdown(assessment: ArchitectureHealthAssessment): string {
  const relevantFindings = assessment.findings.filter(
    (finding) => finding.classification === 'drift' || finding.classification === 'synchronization'
  )

  const output = [
    '# Architecture Drift Report',
    '',
    ...(relevantFindings.length > 0
      ? relevantFindings.map(
          (finding) =>
            `- ${finding.classification}: ${finding.impacted_surface} -> ${finding.message} | ${finding.remediation}`
        )
      : ['- No drift or synchronization findings detected.']),
    '',
  ].join('\n')
  return sanitizePaths(output)
}

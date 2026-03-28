/**
 * @library-module
 * @domain infra
 * @category analysis
 * @description Shared Trivy helpers for running scans, sanitizing output, and evaluating blocking policies.
 * @usage Imported by infra:security scripts under scripts/security/
 */

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { log } from '../utils/logger'

export type FindingKind = 'vulnerability' | 'misconfiguration' | 'secret'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'
export type BlockMode = 'deps' | 'ci' | 'secrets' | 'orchestrator'

export interface SanitizedFinding {
  kind: FindingKind
  severity: Severity
  target: string
  title: string
  identifier: string
  filePath?: string
  packageName?: string
  line?: number
}

export interface SanitizedReport {
  version: 1
  generatedAt: string
  source: 'trivy-fs'
  findings: SanitizedFinding[]
  counts: Record<Severity, number>
}

interface TrivyResultEntry {
  Target?: string
  Type?: string
  Vulnerabilities?: Array<Record<string, unknown>>
  Misconfigurations?: Array<Record<string, unknown>>
  Secrets?: Array<Record<string, unknown>>
}

interface TrivyReport {
  Results?: TrivyResultEntry[]
}

export const TRIVY_VERSION = 'v0.59.1'
export const REPORT_PATH = 'tmp/trivy-report.json'
export const DEFAULT_TIMEOUT = '3m'
export const IGNORE_FILE = '.trivyignore'

const VISIBLE_SEVERITIES = new Set<Severity>(['MEDIUM', 'HIGH', 'CRITICAL'])

export function normalizeSeverity(value: unknown): Severity {
  const upper = typeof value === 'string' ? value.toUpperCase() : 'UNKNOWN'
  if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH' || upper === 'CRITICAL') {
    return upper
  }
  return 'UNKNOWN'
}

export function createEmptyCounts(): Record<Severity, number> {
  return {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
    UNKNOWN: 0,
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function sanitizeVulnerability(target: string, record: Record<string, unknown>): SanitizedFinding {
  return {
    kind: 'vulnerability',
    severity: normalizeSeverity(record.Severity),
    target,
    title: asString(record.Title, asString(record.PkgName, 'Dependency vulnerability')),
    identifier: asString(record.VulnerabilityID, 'UNKNOWN-VULN'),
    packageName: typeof record.PkgName === 'string' ? record.PkgName : undefined,
  }
}

function sanitizeMisconfiguration(
  target: string,
  record: Record<string, unknown>
): SanitizedFinding {
  return {
    kind: 'misconfiguration',
    severity: normalizeSeverity(record.Severity),
    target,
    title: asString(record.Title, 'Infrastructure misconfiguration'),
    identifier: asString(record.AVDID ?? record.ID, 'UNKNOWN-MISCONFIG'),
    filePath:
      typeof record.CauseMetadata === 'object' && record.CauseMetadata !== null
        ? asString((record.CauseMetadata as Record<string, unknown>).Resource, target)
        : target,
  }
}

function sanitizeSecret(target: string, record: Record<string, unknown>): SanitizedFinding {
  return {
    kind: 'secret',
    severity: normalizeSeverity(record.Severity),
    target,
    title: asString(record.Title, 'Secret detected'),
    identifier: asString(record.RuleID ?? record.Category, 'UNKNOWN-SECRET'),
    filePath: asString(record.Target, target),
    line: asNumber(record.StartLine),
  }
}

export function sanitizeTrivyReport(raw: unknown): SanitizedReport {
  const parsed = (raw ?? {}) as TrivyReport
  const findings: SanitizedFinding[] = []
  const counts = createEmptyCounts()

  for (const result of parsed.Results ?? []) {
    const target = asString(result.Target, '.')

    for (const vuln of result.Vulnerabilities ?? []) {
      const finding = sanitizeVulnerability(target, vuln)
      counts[finding.severity]++
      findings.push(finding)
    }

    for (const misconfig of result.Misconfigurations ?? []) {
      const finding = sanitizeMisconfiguration(target, misconfig)
      counts[finding.severity]++
      findings.push(finding)
    }

    for (const secret of result.Secrets ?? []) {
      const finding = sanitizeSecret(target, secret)
      counts[finding.severity]++
      findings.push(finding)
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'trivy-fs',
    findings,
    counts,
  }
}

export function visibleFindings(report: SanitizedReport): SanitizedFinding[] {
  return report.findings.filter(
    (finding) => VISIBLE_SEVERITIES.has(finding.severity) || finding.kind === 'secret'
  )
}

export function isBlockingFinding(finding: SanitizedFinding, mode: BlockMode): boolean {
  if (finding.kind === 'secret') {
    return mode === 'secrets' || mode === 'ci' || mode === 'orchestrator'
  }

  if (finding.kind === 'misconfiguration') {
    if (mode === 'ci') return finding.severity === 'HIGH' || finding.severity === 'CRITICAL'
    if (mode === 'orchestrator') return finding.severity === 'CRITICAL'
    return false
  }

  if (finding.kind === 'vulnerability') {
    if (mode === 'deps' || mode === 'ci')
      return finding.severity === 'HIGH' || finding.severity === 'CRITICAL'
    if (mode === 'orchestrator') return finding.severity === 'CRITICAL'
  }

  return false
}

export function hasBlockingFindings(report: SanitizedReport, mode: BlockMode): boolean {
  return report.findings.some((finding) => isBlockingFinding(finding, mode))
}

export function formatFinding(finding: SanitizedFinding): string {
  const parts = [finding.severity, finding.kind.toUpperCase(), finding.identifier, finding.title]

  if (finding.packageName) {
    parts.push(`pkg=${finding.packageName}`)
  }

  if (finding.filePath) {
    const suffix = finding.line ? `${finding.filePath}:${finding.line}` : finding.filePath
    parts.push(`path=${suffix}`)
  } else {
    parts.push(`target=${finding.target}`)
  }

  return parts.join(' | ')
}

export function printReport(report: SanitizedReport): void {
  const findings = visibleFindings(report)

  if (findings.length === 0) {
    log.info('Trivy scan clean — no MEDIUM/HIGH/CRITICAL or secret findings detected.')
    return
  }

  for (const finding of findings) {
    const prefix = finding.severity === 'MEDIUM' ? 'WARN' : 'ERROR'
    log.info(`[${prefix}] ${formatFinding(finding)}`)
  }
}

export async function writeSanitizedReport(
  report: SanitizedReport,
  filePath = REPORT_PATH
): Promise<void> {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(report, null, 2))
}

async function readStream(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) return ''
  return await new Response(stream).text()
}

export async function runCommand(
  command: string[],
  cwd = process.cwd()
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited,
  ])

  return { exitCode, stdout, stderr }
}

export async function runTrivyFs(options: {
  target: string
  scanners: string[]
  severities?: Severity[]
  timeout?: string
}): Promise<SanitizedReport> {
  const args = [
    'trivy',
    'fs',
    '--scanners',
    options.scanners.join(','),
    '--format',
    'json',
    '--timeout',
    options.timeout ?? DEFAULT_TIMEOUT,
  ]

  if (options.severities && options.severities.length > 0) {
    args.push('--severity', options.severities.join(','))
  }

  if (readFileSafe(IGNORE_FILE) !== null) {
    args.push('--ignorefile', IGNORE_FILE)
  }

  args.push(options.target)

  const result = await runCommand(args)
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr.trim() || `Trivy command failed with exit code ${result.exitCode}`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(
      `Failed to parse Trivy JSON output: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  return sanitizeTrivyReport(parsed)
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export async function getStagedFiles(): Promise<string[]> {
  const result = await runCommand(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'])
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || 'Failed to read staged files')
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function getTrackedFiles(): Promise<string[]> {
  const result = await runCommand(['git', 'ls-files'])
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || 'Failed to read tracked files')
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function materializeStagedFiles(): Promise<{
  targetDir: string
  cleanup: () => void
}> {
  const stagedFiles = await getStagedFiles()
  const targetDir = mkdtempSync(join(tmpdir(), 'zidney-trivy-staged-'))

  for (const filePath of stagedFiles) {
    const blob = await runCommand(['git', 'show', `:${filePath}`])
    if (blob.exitCode !== 0) continue

    const destination = join(targetDir, filePath)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, blob.stdout)
  }

  return {
    targetDir,
    cleanup: () => rmSync(targetDir, { recursive: true, force: true }),
  }
}

export async function materializeTrackedFiles(): Promise<{
  targetDir: string
  cleanup: () => void
}> {
  const trackedFiles = await getTrackedFiles()
  const targetDir = mkdtempSync(join(tmpdir(), 'zidney-trivy-tracked-'))

  for (const filePath of trackedFiles) {
    const source = join(process.cwd(), filePath)
    const destination = join(targetDir, filePath)

    try {
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(source, destination)
    } catch {}
  }

  return {
    targetDir,
    cleanup: () => rmSync(targetDir, { recursive: true, force: true }),
  }
}

export function ensureReportReadable(filePath = REPORT_PATH): SanitizedReport {
  const raw = readFileSafe(filePath)
  if (raw === null) {
    throw new Error(`Report file not found: ${filePath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Unreadable report JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const report = parsed as Partial<SanitizedReport>
  if (!Array.isArray(report.findings) || typeof report.generatedAt !== 'string') {
    throw new Error('Malformed report JSON: missing required fields')
  }

  return report as SanitizedReport
}

export function repoRelative(filePath: string): string {
  return relative(process.cwd(), filePath) || '.'
}

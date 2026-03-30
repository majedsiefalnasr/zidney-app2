/**
 * Trivy Adapter
 *
 * Reads tmp/trivy-report.json (pre-generated, no network) and maps HIGH/CRITICAL
 * CVE findings to PolicyResult[].
 *
 * Does NOT spawn any subprocess. Does NOT make network calls.
 * Never throws. All errors are returned as error-severity PolicyResult entries.
 *
 * @module scripts/policy-engine/adapters/trivy.adapter
 * @library-module
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger } from '../../utils/logger'
import type { PolicyContext, PolicyResult, TrivyVulnerability } from '../types'

const logger = createLogger('policy-engine:adapter:trivy')

const __dir = (import.meta as { dir?: string }).dir ?? fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dir, '../../..')
const TRIVY_PATH = join(REPO_ROOT, 'tmp/trivy-report.json')

const HIGH_SEVERITY_LEVELS = new Set(['HIGH', 'CRITICAL'])

function makeErrorResult(message: string): PolicyResult {
  return {
    ruleId: 'SECURITY-001',
    domain: 'SECURITY',
    severity: 'error',
    message,
  }
}

function mapVulnerabilityToResult(v: TrivyVulnerability): PolicyResult {
  const message = `${v.vulnerabilityId}: ${v.packageName}@${v.installedVersion}${v.description ? ` - ${v.description}` : ''}`
  const suggestion = v.fixedVersion
    ? `Fix: upgrade to ${v.fixedVersion}`
    : 'No fix available yet — monitor for updates'

  return {
    ruleId: 'SECURITY-001',
    domain: 'SECURITY',
    severity: 'error',
    message,
    suggestion,
  }
}

function parseTrivyReport(data: unknown): TrivyVulnerability[] {
  if (Array.isArray(data)) {
    return data as TrivyVulnerability[]
  }

  // Trivy JSON v2 format: { SchemaVersion, ArtifactName, Results: [{ Vulnerabilities: [...] }] }
  const report = data as Record<string, unknown>
  const results = report.Results as Array<Record<string, unknown>> | undefined

  if (results) {
    const vulns: TrivyVulnerability[] = []
    for (const result of results) {
      const vulnerabilities = result.Vulnerabilities as Array<Record<string, unknown>> | undefined
      if (vulnerabilities) {
        for (const v of vulnerabilities) {
          vulns.push({
            vulnerabilityId: String(v.VulnerabilityID ?? ''),
            packageName: String(v.PkgName ?? ''),
            installedVersion: String(v.InstalledVersion ?? ''),
            fixedVersion: v.FixedVersion ? String(v.FixedVersion) : undefined,
            severity: (v.Severity ?? 'UNKNOWN') as TrivyVulnerability['severity'],
            description: v.Description ? String(v.Description) : undefined,
            target: v.Target ? String(v.Target) : undefined,
          })
        }
      }
    }
    return vulns
  }

  return []
}

/**
 * Read Trivy vulnerability report and return HIGH/CRITICAL findings as PolicyResult[].
 *
 * - Absent file: returns [] (Trivy is optional in dev)
 * - JSON parse failure: returns single error result
 * - No subprocess / no network calls
 */
export async function runTrivy(_context: PolicyContext): Promise<PolicyResult[]> {
  logger.debug('Reading Trivy report', { path: TRIVY_PATH })

  try {
    const file = Bun.file(TRIVY_PATH)
    const exists = await file.exists()

    if (!exists) {
      logger.debug('Trivy report not found — skipping security scan', {
        path: TRIVY_PATH,
      })
      return []
    }

    let rawData: unknown
    try {
      rawData = await file.json()
    } catch (err) {
      return [makeErrorResult(`Trivy report parse failed: ${String(err)}`)]
    }

    const vulnerabilities = parseTrivyReport(rawData)
    const filtered = vulnerabilities.filter((v) => HIGH_SEVERITY_LEVELS.has(v.severity))

    logger.debug('Trivy report loaded', {
      total: vulnerabilities.length,
      highCritical: filtered.length,
    })

    return filtered.map(mapVulnerabilityToResult)
  } catch (err) {
    const message = `Trivy adapter failed: ${String(err)}`
    logger.error(message)
    return [makeErrorResult(message)]
  }
}

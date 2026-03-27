/** @library-module */
import type { HealthFinding, HealthFindingSeverity, HealthSignalId } from './types'

const SEVERITY_RANK: Record<HealthFindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

function uniqueSignalIds(values: HealthSignalId[]): HealthSignalId[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  ) as HealthSignalId[]
}

export function createFindingFingerprint(finding: HealthFinding): string {
  const file = finding.location?.file ?? ''
  const line = finding.location?.line ?? 0
  const column = finding.location?.column ?? 0

  return [
    finding.classification,
    finding.impacted_surface.trim().toLowerCase(),
    file.trim().toLowerCase(),
    String(line),
    String(column),
    finding.message.trim().toLowerCase(),
  ].join('::')
}

function maxSeverity(
  left: HealthFindingSeverity,
  right: HealthFindingSeverity
): HealthFindingSeverity {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right] ? left : right
}

export function normalizeFindings(findings: HealthFinding[]): HealthFinding[] {
  const merged = new Map<string, HealthFinding>()

  for (const finding of findings) {
    const fingerprint = createFindingFingerprint(finding)
    const existing = merged.get(fingerprint)

    if (!existing) {
      merged.set(fingerprint, {
        ...finding,
        signal_ids: [...finding.signal_ids].sort((left, right) => left.localeCompare(right)),
        source_tools: uniqueSorted(finding.source_tools),
      })
      continue
    }

    merged.set(fingerprint, {
      ...existing,
      severity: maxSeverity(existing.severity, finding.severity),
      signal_ids: uniqueSignalIds([...existing.signal_ids, ...finding.signal_ids]),
      source_tools: uniqueSorted([...existing.source_tools, ...finding.source_tools]),
      remediation:
        existing.remediation.length >= finding.remediation.length
          ? existing.remediation
          : finding.remediation,
    })
  }

  return Array.from(merged.values()).sort((left, right) =>
    left.finding_id.localeCompare(right.finding_id)
  )
}

/**
 * License Aggregation Functions for MMC Dashboard
 *
 * Purpose: Calculate license status counts and metrics
 * - Count licenses by status (ACTIVE, SOFT_LOCKED, ARCHIVED)
 * - Handle null/empty result sets
 * - Type-safe aggregations
 */

export interface LicenseCount {
  status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED'
  count: number
}

export interface LicenseCounts {
  total: number
  active: number
  soft_locked: number
  archived: number
}

export function aggregateLicenseCounts(records: LicenseCount[]): LicenseCounts {
  const counts: LicenseCounts = {
    total: 0,
    active: 0,
    soft_locked: 0,
    archived: 0,
  }

  for (const record of records) {
    counts.total += record.count

    if (record.status === 'ACTIVE') {
      counts.active = record.count
    } else if (record.status === 'SOFT_LOCKED') {
      counts.soft_locked = record.count
    } else if (record.status === 'ARCHIVED') {
      counts.archived = record.count
    }
  }

  return counts
}

export function calculateLicenseHealthScore(counts: LicenseCounts): number {
  if (counts.total === 0) return 100

  const activePercent = (counts.active / counts.total) * 100
  const lockedPercent = (counts.soft_locked / counts.total) * 100
  const archivedPercent = (counts.archived / counts.total) * 100

  if (activePercent === 100) return 100
  if (lockedPercent <= 5 && archivedPercent <= 2) return 75
  if (lockedPercent <= 15 && archivedPercent <= 5) return 50
  if (lockedPercent <= 25 && archivedPercent <= 15) return 25
  return 0
}

export function getLicenseSummary(counts: LicenseCounts) {
  return {
    total_licenses: counts.total,
    active_percent:
      counts.total > 0
        ? ((counts.active / counts.total) * 100).toFixed(1)
        : '0',
    soft_locked_percent:
      counts.total > 0
        ? ((counts.soft_locked / counts.total) * 100).toFixed(1)
        : '0',
    archived_percent:
      counts.total > 0
        ? ((counts.archived / counts.total) * 100).toFixed(1)
        : '0',
    health_score: calculateLicenseHealthScore(counts),
  }
}

export function compareLicenseCounts(
  current: LicenseCounts,
  previous: LicenseCounts
) {
  return {
    total_change: current.total - previous.total,
    active_change: current.active - previous.active,
    soft_locked_change: current.soft_locked - previous.soft_locked,
    archived_change: current.archived - previous.archived,
  }
}

export default {
  aggregateLicenseCounts,
  calculateLicenseHealthScore,
  getLicenseSummary,
  compareLicenseCounts,
}

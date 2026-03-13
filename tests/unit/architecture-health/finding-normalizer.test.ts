import { describe, expect, it } from 'vitest'
import { normalizeFindings } from '../../../scripts/architecture-health/finding-normalizer'
import type { HealthFinding } from '../../../scripts/architecture-health/types'

const baseFinding: HealthFinding = {
  finding_id: 'duplicate-finding',
  signal_ids: ['architecture_drift'],
  classification: 'drift',
  severity: 'medium',
  impacted_surface: 'scripts/architecture-health',
  message: 'Duplicate finding example',
  remediation: 'Do the longer remediation',
  source_tools: ['architecture-health'],
}

describe('architecture-health finding normalizer', () => {
  it('deduplicates repeated findings and merges metadata', () => {
    const findings = normalizeFindings([
      baseFinding,
      {
        ...baseFinding,
        severity: 'high',
        signal_ids: ['architecture_drift', 'intelligence_synchronization'],
        source_tools: ['gitnexus'],
      },
    ])

    expect(findings).toHaveLength(1)
    expect(findings[0]!.severity).toBe('high')
    expect(findings[0]!.signal_ids).toEqual(['architecture_drift', 'intelligence_synchronization'])
    expect(findings[0]!.source_tools).toEqual(['architecture-health', 'gitnexus'])
  })
})

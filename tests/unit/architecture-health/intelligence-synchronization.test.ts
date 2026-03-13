import { describe, expect, it } from 'vitest'
import { createRefreshResolutionFinding } from '../../../scripts/architecture-health/intelligence-snapshot'

describe('architecture-health intelligence synchronization', () => {
  it('creates a low-severity finding when refresh resolves synchronization to current', () => {
    const finding = createRefreshResolutionFinding('STALE', 'CURRENT')
    expect(finding.severity).toBe('low')
    expect(finding.message).toContain('STALE')
    expect(finding.message).toContain('CURRENT')
  })

  it('creates a medium-severity finding when refresh still leaves synchronization non-current', () => {
    const finding = createRefreshResolutionFinding('INVALID', 'STALE')
    expect(finding.severity).toBe('medium')
  })
})

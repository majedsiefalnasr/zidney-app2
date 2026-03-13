import { describe, expect, it } from 'vitest'
import { shouldPersistHistorySnapshot } from '../../../scripts/architecture-health/report-writer'

describe('architecture-health report writer history policy', () => {
  it('does not persist a duplicate history snapshot for the same assessment id', () => {
    expect(shouldPersistHistorySnapshot([{ assessment_id: 'same-state' }], 'same-state')).toBe(
      false
    )
  })

  it('persists a new history snapshot for a new assessment id', () => {
    expect(shouldPersistHistorySnapshot([{ assessment_id: 'same-state' }], 'new-state')).toBe(true)
  })
})

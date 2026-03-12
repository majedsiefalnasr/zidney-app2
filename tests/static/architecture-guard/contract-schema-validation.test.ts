import { describe, expect, it } from 'vitest'
import { buildJsonReport } from '../../../scripts/architecture-guard/reporters/json-reporter'

describe('Unified guard JSON contract schema validation', () => {
  it('emits required schema fields with valid enums', () => {
    const report = buildJsonReport({
      mode: 'strict',
      scope: {
        modules_validated: 1,
        modules_skipped: 0,
        skipped_unmapped_files: [],
      },
      fallbackReason: null,
      contractError: false,
      violations: [],
      durationMs: 1,
    })

    expect(typeof report.run_id).toBe('string')
    expect(typeof report.timestamp).toBe('string')
    expect(['development', 'strict', 'changed']).toContain(report.validation_mode)
    expect(['PASS', 'BLOCKED']).toContain(report.verdict)
    expect(Array.isArray(report.violations)).toBe(true)
    expect(typeof report.duration_ms).toBe('number')
  })
})

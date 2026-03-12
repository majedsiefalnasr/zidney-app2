import { describe, expect, it } from 'vitest'
import { buildJsonReport } from '../../../scripts/architecture-guard/reporters/json-reporter'

describe('Unified guard report backward compatibility', () => {
  it('keeps stable top-level JSON structure snapshot', () => {
    const report = buildJsonReport({
      mode: 'changed',
      scope: {
        modules_validated: 2,
        modules_skipped: 3,
        skipped_unmapped_files: ['docs/readme.md'],
      },
      fallbackReason: 'graph_missing',
      contractError: false,
      violations: [
        {
          rule: 'dependency-boundaries',
          severity: 'error',
          message: 'Sample violation',
          location: { file: 'apps/mmc/src/main.ts', line: 10, column: 2 },
          source_module: 'apps/mmc',
          remediation: 'Sample remediation',
        },
      ],
      durationMs: 5,
    })

    expect(Object.keys(report).sort()).toEqual([
      'contract_error',
      'duration_ms',
      'fallback_reason',
      'run_id',
      'scope',
      'timestamp',
      'validation_mode',
      'verdict',
      'violations',
    ])
  })
})

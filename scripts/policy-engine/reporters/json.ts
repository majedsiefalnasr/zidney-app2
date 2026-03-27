/**
 * JSON Reporter
 *
 * Outputs PolicyResult[] as a stable JSON array to stdout (FR-025, NFR-007).
 * Results are pre-sorted by the engine before reaching the reporter.
 * No timestamps, correlation IDs, or non-deterministic fields.
 *
 * @module scripts/policy-engine/reporters/json
 * @library-module
 */

import type { PolicyResult, Reporter } from '../types'

export class JsonReporter implements Reporter {
  report(results: PolicyResult[]): void {
    process.stdout.write(`${JSON.stringify(results, null, 2)}
`)
  }
}

/**
 * @script infra:security
 * @domain infra
 * @category analysis
 * @description Run a full Trivy filesystem scan and print visible findings without blocking on non-clean results.
 * @usage bun run infra:security
 */

import { exit, log } from '../utils/logger'
import { materializeTrackedFiles, printReport, runTrivyFs } from './trivy-config'

log.setScript('infra:security')

async function main(): Promise<void> {
  log.header('SECURITY SCAN', 'Full Trivy filesystem scan across repo')
  const tracked = await materializeTrackedFiles()
  try {
    const report = await runTrivyFs({
      target: tracked.targetDir,
      scanners: ['vuln', 'secret', 'misconfig'],
      severities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    })

    printReport(report)
    log.result({ total: 1, passed: 1, failed: 0 })
  } finally {
    tracked.cleanup()
  }
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error))
  exit(1)
})

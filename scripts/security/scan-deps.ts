/**
 * @script infra:security:deps
 * @domain infra
 * @category analysis
 * @description Run a dependency-only Trivy scan, warning on MEDIUM findings and blocking on HIGH/CRITICAL vulnerabilities.
 * @usage bun run infra:security:deps
 */

import { exit, log } from '../utils/logger'
import {
  hasBlockingFindings,
  materializeTrackedFiles,
  printReport,
  runTrivyFs,
} from './trivy-config'

log.setScript('infra:security:deps')

async function main(): Promise<void> {
  log.header('SECURITY SCAN DEPS', 'Trivy dependency vulnerability scan')
  const tracked = await materializeTrackedFiles()
  try {
    const report = await runTrivyFs({
      target: tracked.targetDir,
      scanners: ['vuln'],
      severities: ['MEDIUM', 'HIGH', 'CRITICAL'],
    })

    printReport(report)
    const blocked = hasBlockingFindings(report, 'deps')
    log.result({ total: 1, passed: blocked ? 0 : 1, failed: blocked ? 1 : 0 })
    exit(blocked ? 1 : 0)
  } finally {
    tracked.cleanup()
  }
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error))
  exit(1)
})

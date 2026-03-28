/**
 * @script infra:security:ci
 * @domain infra
 * @category analysis
 * @description Run the CI-equivalent Trivy scan, write a sanitized report, and block on CI-grade findings.
 * @usage bun run infra:security:ci
 */

import { exit, log } from '../utils/logger'
import {
  hasBlockingFindings,
  materializeTrackedFiles,
  printReport,
  REPORT_PATH,
  runTrivyFs,
  writeSanitizedReport,
} from './trivy-config'

log.setScript('infra:security:ci')

async function main(): Promise<void> {
  log.header('SECURITY SCAN CI', 'CI-grade Trivy scan with sanitized report')
  const tracked = await materializeTrackedFiles()
  try {
    const report = await runTrivyFs({
      target: tracked.targetDir,
      scanners: ['vuln', 'secret', 'misconfig'],
      severities: ['MEDIUM', 'HIGH', 'CRITICAL'],
    })

    await writeSanitizedReport(report, REPORT_PATH)
    printReport(report)
    const blocked = hasBlockingFindings(report, 'ci')
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

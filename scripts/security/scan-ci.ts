/**
 * @script infra:security:ci
 * @domain infra
 * @category analysis
 * @description Run the CI-equivalent Trivy scan, write a sanitized report, and block on CI-grade findings.
 * @usage bun run infra:security:ci
 */

import {
  hasBlockingFindings,
  materializeTrackedFiles,
  printReport,
  REPORT_PATH,
  runTrivyFs,
  writeSanitizedReport,
} from './trivy-config'

async function main(): Promise<void> {
  const tracked = await materializeTrackedFiles()
  try {
    const report = await runTrivyFs({
      target: tracked.targetDir,
      scanners: ['vuln', 'secret', 'misconfig'],
      severities: ['MEDIUM', 'HIGH', 'CRITICAL'],
    })

    await writeSanitizedReport(report, REPORT_PATH)
    printReport(report)
    process.exit(hasBlockingFindings(report, 'ci') ? 1 : 0)
  } finally {
    tracked.cleanup()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

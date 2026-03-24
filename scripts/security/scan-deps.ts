/**
 * @script infra:security:deps
 * @domain infra
 * @category analysis
 * @description Run a dependency-only Trivy scan, warning on MEDIUM findings and blocking on HIGH/CRITICAL vulnerabilities.
 * @usage bun run infra:security:deps
 */

import {
  hasBlockingFindings,
  materializeTrackedFiles,
  printReport,
  runTrivyFs,
} from './trivy-config'

async function main(): Promise<void> {
  const tracked = await materializeTrackedFiles()
  try {
    const report = await runTrivyFs({
      target: tracked.targetDir,
      scanners: ['vuln'],
      severities: ['MEDIUM', 'HIGH', 'CRITICAL'],
    })

    printReport(report)
    process.exit(hasBlockingFindings(report, 'deps') ? 1 : 0)
  } finally {
    tracked.cleanup()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

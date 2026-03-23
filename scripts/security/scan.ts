/**
 * @script infra:security
 * @domain infra
 * @category analysis
 * @description Run a full Trivy filesystem scan and print visible findings without blocking on non-clean results.
 * @usage bun run infra:security
 */

import { materializeTrackedFiles, printReport, runTrivyFs } from './trivy-config'

async function main(): Promise<void> {
  const tracked = await materializeTrackedFiles()
  try {
    const report = await runTrivyFs({
      target: tracked.targetDir,
      scanners: ['vuln', 'secret', 'misconfig'],
      severities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    })

    printReport(report)
  } finally {
    tracked.cleanup()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

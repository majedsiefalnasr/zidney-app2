/**
 * @script infra:security:secrets
 * @domain infra
 * @category analysis
 * @description Run a Trivy secret scan across the repo or staged files only and block on any detected secret.
 * @usage bun run infra:security:secrets [--staged]
 */

import {
  hasBlockingFindings,
  materializeStagedFiles,
  materializeTrackedFiles,
  printReport,
  runTrivyFs,
} from './trivy-config'

const stagedOnly = process.argv.includes('--staged')

async function main(): Promise<void> {
  if (stagedOnly) {
    const staged = await materializeStagedFiles()
    try {
      const report = await runTrivyFs({
        target: staged.targetDir,
        scanners: ['secret'],
        severities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      })
      printReport(report)
      process.exit(hasBlockingFindings(report, 'secrets') ? 1 : 0)
    } finally {
      staged.cleanup()
    }
  } else {
    const tracked = await materializeTrackedFiles()
    try {
      const report = await runTrivyFs({
        target: tracked.targetDir,
        scanners: ['secret'],
        severities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      })
      printReport(report)
      process.exit(hasBlockingFindings(report, 'secrets') ? 1 : 0)
    } finally {
      tracked.cleanup()
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

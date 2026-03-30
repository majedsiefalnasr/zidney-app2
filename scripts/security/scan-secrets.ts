#!/usr/bin/env bun

/**
 * @script infra:security:secrets
 * @domain infra
 * @category analysis
 * @description Run a Trivy secret scan across the repo or staged files only and block on any detected secret.
 * @usage bun run infra:security:secrets [--staged]
 */

import { exit, hasCiFlag, log } from '../utils/logger'
import {
  hasBlockingFindings,
  materializeStagedFiles,
  materializeTrackedFiles,
  printReport,
  runTrivyFs,
} from './trivy-config'

const args = process.argv.slice(2)
const stagedOnly = args.includes('--staged')
const isCi = hasCiFlag(args)

log.setScript('infra:security:secrets')

async function main(): Promise<void> {
  log.header('SECURITY SCAN SECRETS', 'Trivy secret scan across repo or staged files')
  if (isCi) {
    log.info('[infra:security:secrets] CI mode enabled')
  }
  if (stagedOnly) {
    const staged = await materializeStagedFiles()
    try {
      const report = await runTrivyFs({
        target: staged.targetDir,
        scanners: ['secret'],
        severities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      })
      printReport(report)
      const blockedStaged = hasBlockingFindings(report, 'secrets')
      log.result({ total: 1, passed: blockedStaged ? 0 : 1, failed: blockedStaged ? 1 : 0 })
      exit(blockedStaged ? 1 : 0)
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
      const blocked = hasBlockingFindings(report, 'secrets')
      log.result({ total: 1, passed: blocked ? 0 : 1, failed: blocked ? 1 : 0 })
      exit(blocked ? 1 : 0)
    } finally {
      tracked.cleanup()
    }
  }
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error))
  exit(1)
})

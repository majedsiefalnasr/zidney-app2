#!/usr/bin/env bun

/**
 * @script governance:gate:ci
 * @domain governance
 * @category governance
 * @description CI variant of the governance gate — runs gate.ts with GitHub Actions annotations
 *
 * @usage bun run governance:gate:ci
 */

import { $ } from 'bun'
import { exit, log } from '../utils/logger'

log.setScript('governance:gate:ci')

async function main(): Promise<void> {
  log.header('GOVERNANCE GATE CI', 'CI variant of the governance gate with GHA annotations')

  log.step('::group::Unified Governance Gate')

  const proc = await $`bun run governance:gate`.nothrow()
  const exitCode = proc.exitCode ?? 1

  log.step('::endgroup::')

  if (exitCode !== 0) {
    log.error('::error::Governance gate failed — see output above')
    log.result({ failed: 1, message: 'Governance gate CI failed.' })
  } else {
    log.result({ passed: 1, failed: 0, message: 'Governance gate CI passed.' })
  }

  exit(exitCode)
}

main()

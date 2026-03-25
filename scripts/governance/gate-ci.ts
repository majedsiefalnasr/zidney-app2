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

async function main(): Promise<void> {
  console.log('::group::Unified Governance Gate')

  const proc = await $`bun run governance:gate`.nothrow()
  const exitCode = proc.exitCode ?? 1

  console.log('::endgroup::')

  if (exitCode !== 0) {
    console.error('::error::Governance gate failed — see output above')
  }

  process.exit(exitCode)
}

main()

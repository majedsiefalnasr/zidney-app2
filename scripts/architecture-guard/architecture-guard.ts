#!/usr/bin/env bun

/**
 * @script arch:guard
 * @domain arch
 * @category governance
 * @description Run the unified architecture guard and exit non-zero when governance violations are detected.
 * @usage bun run arch:guard
 */

/** @library-module */

import { runUnifiedArchitectureGuard } from './runner'

runUnifiedArchitectureGuard().then((exitCode) => {
  process.exit(exitCode)
})

#!/usr/bin/env bun
/** @library-module */

import { runUnifiedArchitectureGuard } from './runner'

runUnifiedArchitectureGuard().then((exitCode) => {
  process.exit(exitCode)
})

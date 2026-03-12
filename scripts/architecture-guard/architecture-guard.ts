#!/usr/bin/env bun

import { runUnifiedArchitectureGuard } from './runner'

runUnifiedArchitectureGuard().then((exitCode) => {
  process.exit(exitCode)
})

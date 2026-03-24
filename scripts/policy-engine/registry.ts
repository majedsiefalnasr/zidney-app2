import { artifactAllowlistRule } from './rules/fix-03/artifact-allowlist'
import { autoFixAttemptRule } from './rules/fix-03/auto-fix-attempt'
import { buildPassRule } from './rules/fix-03/build-pass'
import { coverageThresholdRule } from './rules/fix-03/coverage-threshold'
import { environmentReadyRule } from './rules/fix-03/environment-ready'
import { noArtifactDriftRule } from './rules/fix-03/no-artifact-drift'
import { repoCleanRule } from './rules/fix-03/repo-clean'
import { testIsolationRule } from './rules/fix-03/test-isolation'
import { testPassRule } from './rules/fix-03/test-pass'
import type { PolicyRule } from './types'

export const rules: PolicyRule[] = [
  environmentReadyRule, // 1 — always first; hard-stops runner on failure
  autoFixAttemptRule, // 2 — populates context.autoFixedPaths
  buildPassRule, // 3 — --changed scoped
  testPassRule, // 4 — --changed scoped
  testIsolationRule, // 5 — always runs
  repoCleanRule, // 6 — always runs; reads context.autoFixedPaths
  noArtifactDriftRule, // 7 — always runs
  artifactAllowlistRule, // 8 — always runs
  coverageThresholdRule, // 9 — --full only; warning-severity only
]

#!/usr/bin/env node
 

/**
 * Zidney Hard Mode Validation Script
 * Enforces workflow-state integrity before allowing CI merge.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const statePath = path.resolve(
  __dirname,
  '../specs/runtime/.workflow-state.json'
)

function fail(message) {
  console.error(`\n❌ HARD MODE VALIDATION FAILED:\n${message}\n`)
  process.exit(1)
}

function success(message) {
  console.log(`\n✅ HARD MODE VALIDATION PASSED:\n${message}\n`)
}

if (!fs.existsSync(statePath)) {
  fail('Missing specs/runtime/.workflow-state.json')
}

let state

try {
  const raw = fs.readFileSync(statePath, 'utf-8')
  state = JSON.parse(raw)
} catch (err) {
  fail('Invalid JSON format in specs/runtime/.workflow-state.json')
}

// Required fields
const requiredFields = [
  'stage',
  'phase',
  'current_step',
  'clarifications_resolved',
  'drift_passed',
  'implementation_allowed',
]

for (const field of requiredFields) {
  if (!(field in state)) {
    fail(`Missing required field in state file: ${field}`)
  }
}

// Basic workflow integrity checks
if (!state.stage || !state.phase) {
  fail('Stage or Phase not defined.')
}

if (state.clarifications_resolved !== true) {
  fail('Clarifications have not been resolved.')
}

if (state.drift_passed !== true) {
  fail('Drift detection has not passed. Analyze stage incomplete.')
}

if (state.implementation_allowed !== true) {
  fail('Implementation not authorized by Hard Mode.')
}

// Migration enforcement (prevent unplanned schema changes)
try {
  const baseRef =
    process.env.GITHUB_BASE_REF || process.env.BASE_REF || 'develop'

  const diff = execSync(`git diff --name-only origin/${baseRef}...HEAD`, {
    encoding: 'utf-8',
  })
  const changedFiles = diff.split('\n').filter(Boolean)

  const migrationFiles = changedFiles.filter(
    (file) =>
      file.includes('migration') ||
      file.includes('migrations') ||
      file.endsWith('.sql')
  )

  if (migrationFiles.length > 0) {
    if (!state.plan_completed) {
      fail(
        `Detected migration or schema changes without approved plan:\n${migrationFiles.join('\n')}`
      )
    }
  }
} catch (err) {
  fail('Unable to perform migration validation via git diff.')
}

// Constitution enforcement
if (state.constitution_version && state.constitution_version !== 'v1.2.0') {
  fail('Constitution version mismatch. Expected v1.2.0')
}

success('Workflow state is valid and compliant with Hard Mode governance.')

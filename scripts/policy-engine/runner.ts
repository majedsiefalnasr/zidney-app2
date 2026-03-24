import { rules } from './registry'
import type { PolicyContext } from './types'

const mode: PolicyContext['mode'] = process.argv.includes('--changed') ? 'changed' : 'full'
const context: PolicyContext = { mode }

if (rules.length === 0) {
  console.log('Policy check passed — no rules registered')
  process.exit(0)
}

const results = []
for (const rule of rules) {
  const result = await rule.run(context)
  results.push(result)
  if (result.success) {
    console.log(`[PASS] ${result.ruleId}`)
  } else {
    console.log(`[FAIL] ${result.ruleId}: ${result.message ?? 'no message'}`)
  }
}

const hasError = results.some((r) => !r.success && r.severity === 'error')
if (hasError) {
  console.error('Policy check failed')
  process.exit(1)
} else {
  console.log('Policy check passed')
  process.exit(0)
}

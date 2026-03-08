// Fixture: valid imports — all within packages/ boundary

import { logger } from '@zidney/logger'
import type { Tenant } from '@zidney/types'
import { validate } from '@zidney/validation'

// Example usage to satisfy linter
const _tenant: Tenant | null = null
const _logUsed = logger
const _validateUsed = validate
export const clean = { _tenant, _logUsed, _validateUsed }

import type { PolicyRule } from './types'

const dummyRule: PolicyRule = {
  id: 'dummy',
  async run(_ctx) {
    return { ruleId: 'dummy', success: true, severity: 'warning' }
  },
}

export const rules: PolicyRule[] = [dummyRule]

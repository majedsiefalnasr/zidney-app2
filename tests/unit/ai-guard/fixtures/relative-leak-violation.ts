// Fixture: relative path that leaks through architecture boundary

import { anotherUtil } from '../../../packages/domain-core/src/index'
import { someUtil } from '../../apps/api/src/utils/tenant'

// Example usage to satisfy linter
const _someUtilUsed = someUtil
const _anotherUtilUsed = anotherUtil
export const violations = { _someUtilUsed, _anotherUtilUsed }

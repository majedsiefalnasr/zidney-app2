// Fixture: cross-app violation — apps/api importing from apps/mmc

import { anotherThing } from 'apps/backoffice/src/utils/helper'
import { something } from 'apps/mmc/src/services/something'

// Example usage to satisfy linter
const _somethingUsed = something
const _anotherThingUsed = anotherThing
export const violations = { _somethingUsed, _anotherThingUsed }

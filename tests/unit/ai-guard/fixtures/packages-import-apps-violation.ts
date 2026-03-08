// Fixture: packages importing apps — violates layer isolation rule
import { handler } from 'apps/api/src/routes/workspace'
import { workerJob } from 'apps/worker/src/jobs/attempt-finalize'

// Example usage to satisfy linter
const _handlerUsed = handler
const _workerJobUsed = workerJob
export const violations = { _handlerUsed, _workerJobUsed }

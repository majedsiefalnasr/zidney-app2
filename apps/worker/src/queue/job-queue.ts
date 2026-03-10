/**
 * Re-export JobQueue from shared package for backward compatibility
 * The actual implementation is now in @zidney/job-queue
 */
export {
  type AttemptSnapshot,
  createGradeAttemptJob,
  type GradeAttemptJob,
  JobQueue,
  type JobQueueEntry,
  type JobResult,
  type SubmissionData,
} from '@zidney/job-queue'

import { JobQueue } from '@zidney/job-queue'
import { redis } from '../infrastructure/redis'

// Create and export singleton instance
export const jobQueue = new JobQueue(redis as Parameters<(typeof JobQueue)['constructor']>[0])

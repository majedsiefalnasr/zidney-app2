/**
 * Idempotency key middleware (Task 22)
 * Prevents duplicate upgrade submissions
 * Applied to: POST /api/admin/workspace/{workspace_id}/upgrade*
 */

import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'
import { Database } from 'pg'

/**
 * Create idempotency middleware
 */
export function createIdempotencyMiddleware(masterDb: Database) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { workspace_id } = req.params
    const { target_schema_version } = req.body || {}
    const correlation_id =
      req.headers['x-correlation-id'] || crypto.randomUUID()

    if (!target_schema_version) {
      return next()
    }

    try {
      // Generate idempotency key
      const idempotencyKey = `upgrade-${workspace_id}-${target_schema_version}`

      // Check if duplicate already in progress
      const result = await masterDb.query(
        `SELECT COUNT(*) as count FROM migration_registry 
         WHERE workspace_id = $1 
         AND target_schema_version = $2 
         AND applied_at > now() - interval '5 minutes'
         AND status = 'SUCCESS'`,
        [workspace_id, target_schema_version]
      )

      if (result.rows[0].count > 0) {
        // Duplicate submission detected, return cached success
        console.log(
          JSON.stringify({
            level: 'DEBUG',
            service: 'idempotency-middleware',
            event: 'duplicate_submission_detected',
            correlation_id,
            workspace_id,
            target_version: target_schema_version,
            timestamp: new Date().toISOString(),
          })
        )

        return res.status(202).json({
          success: true,
          data: {
            workspace_id,
            target_schema_version,
            status: 'QUEUED',
            note: 'This version was recently upgraded. Returning cached status.',
          },
          error: null,
        })
      }

      // Attach idempotency context
      ;(req as any).idempotencyKey = idempotencyKey

      next()
    } catch (err: any) {
      // On error, allow through
      next()
    }
  }
}

import { Context, Hono } from 'hono'
import { toLicenseError } from '../../responses/license-error-handler'
import { logger } from '../../services/logger'
import { createUserWithLimitCheck } from '../../utils/transaction-wrapper'

/**
 * Backoffice Users Router
 *
 * Routes for user management within a workspace (backoffice).
 * All routes require license enforcement middleware (inherited from parent router).
 *
 * Task: T020 – Create User Creation Endpoint with Limit Check
 */
export const backofficeUsersRouter = new Hono()

/**
 * POST /api/backoffice/users
 * Create a new user in the workspace with limit enforcement
 *
 * Auth: Backoffice staff role required
 * Middleware: License enforcement (3rd layer) + tenant resolver (2nd layer)
 * Transactions: YES (SELECT FOR UPDATE + COUNT + INSERT)
 * Idempotency: NO (caller handles dedup if needed)
 * Rate Limit: N/A (handled by license limits)
 * Response: {success, data: {user_id, name, role, ...}, error}
 */
backofficeUsersRouter.post('/backoffice/users', async (ctx: Context) => {
  const correlationId = ctx.get('correlation_id')
  const masterDb = ctx.get('master_db')
  const tenantDb = ctx.get('tenant_db')
  const workspace_id = ctx.get('workspace_id')
  const licenseId = ctx.get('license_id')
  const studentLimit = ctx.get('student_limit')
  const staffLimit = ctx.get('staff_limit')

  try {
    // Extract request body
    const body = await ctx.req.json()
    const { name, email, role, user_id } = body

    // Validate required fields
    if (!name || !email || !role) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'user_create_invalid_input',
          workspace_id,
          error_code: 'INVALID_REQUEST',
        },
        'Invalid user creation request'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST', 400), { status: 400 })
    }

    // Validate role
    const validRoles = ['STUDENT', 'STAFF', 'ADMIN']
    if (!validRoles.includes(role)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'user_create_invalid_role',
          workspace_id,
          role,
          error_code: 'INVALID_ROLE',
        },
        'Invalid user role'
      )
      return ctx.json(toLicenseError('INVALID_ROLE', 400), { status: 400 })
    }

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'user_create_invalid_email',
          workspace_id,
          email,
          error_code: 'INVALID_EMAIL',
        },
        'Invalid email format'
      )
      return ctx.json(toLicenseError('INVALID_EMAIL', 400), { status: 400 })
    }

    // Determine limit based on role
    let roleLimit: number | null = null
    if (role === 'STUDENT') {
      roleLimit =
        studentLimit === 'unlimited' ? null : parseInt(studentLimit, 10)
    } else if (role === 'STAFF') {
      roleLimit = staffLimit === 'unlimited' ? null : parseInt(staffLimit, 10)
    }
    // ADMIN has no limit

    // Call transaction wrapper with limit enforcement
    const transactionResult = await createUserWithLimitCheck(
      masterDb,
      tenantDb,
      {
        workspace_id,
        user_id: user_id || crypto.randomUUID(),
        role: role as 'STUDENT' | 'STAFF',
        name,
        email,
        limit: roleLimit,
        license_id: licenseId,
      }
    )

    // Handle transaction result
    if (!transactionResult.success) {
      // Check specific error code
      if (transactionResult.error_code === 'LIMIT_EXCEEDED') {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'user_create_limit_exceeded',
            workspace_id,
            role,
            limit: roleLimit,
            error_code: transactionResult.error_code,
          },
          `${role} limit exceeded`
        )
        return ctx.json(toLicenseError('STUDENT_LIMIT_EXCEEDED', 402), {
          status: 402,
        })
      }

      if (transactionResult.error_code === 'DUPLICATE_EMAIL') {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'user_create_duplicate_email',
            workspace_id,
            email,
            error_code: transactionResult.error_code,
          },
          'Duplicate email'
        )
        return ctx.json(toLicenseError('EMAIL_EXISTS', 409), { status: 409 })
      }

      if (transactionResult.error_code === 'SOFT_LOCKED') {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'user_create_soft_locked',
            workspace_id,
            error_code: transactionResult.error_code,
          },
          'License is soft-locked'
        )
        return ctx.json(toLicenseError('LICENSE_SOFT_LOCKED', 423), {
          status: 423,
        })
      }

      if (transactionResult.error_code === 'ARCHIVED') {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'user_create_archived',
            workspace_id,
            error_code: transactionResult.error_code,
          },
          'License is archived'
        )
        return ctx.json(toLicenseError('LICENSE_ARCHIVED', 403), {
          status: 403,
        })
      }

      // Generic error
      logger.error(
        {
          correlation_id: correlationId,
          action: 'user_create_transaction_error',
          workspace_id,
          error_code: transactionResult.error_code,
        },
        `User creation failed: ${transactionResult.error_code}`
      )
      return ctx.json(toLicenseError('INTERNAL_ERROR', 500), { status: 500 })
    }

    // Success: User created
    logger.info(
      {
        correlation_id: correlationId,
        action: 'user_created',
        workspace_id,
        user_id: transactionResult.user_id,
        role,
        limit_check: `${roleLimit || 'unlimited'}`,
      },
      'User created successfully'
    )

    return ctx.json(
      {
        success: true,
        data: {
          user_id: transactionResult.user_id,
          name,
          email,
          role,
          status: 'ENABLED',
          created_at: new Date().toISOString(),
        },
        error: null,
      },
      { status: 201 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'user_create_error',
        workspace_id,
        error_message: error.message,
      },
      'User creation failed'
    )

    return ctx.json(toLicenseError('INTERNAL_ERROR', 500), { status: 500 })
  }
})

/**
 * GET /api/backoffice/users
 * List all users in the workspace
 *
 * Auth: Backoffice staff role required
 * Middleware: License enforcement + tenant resolver
 * Transactions: NO (read-only)
 * Response: Array of user objects
 */
backofficeUsersRouter.get('/backoffice/users', async (ctx: Context) => {
  const correlationId = ctx.get('correlation_id')
  const tenantDb = ctx.get('tenant_db')
  const workspace_id = ctx.get('workspace_id')

  try {
    // Query all enabled users
    const result = await tenantDb.query(
      'SELECT id, name, email, role, status, created_at FROM users WHERE status=$1 ORDER BY created_at DESC',
      ['ENABLED']
    )

    logger.debug(
      {
        correlation_id: correlationId,
        action: 'users_listed',
        workspace_id,
        count: result.rows.length,
      },
      'Users listed'
    )

    return ctx.json(
      {
        success: true,
        data: result.rows,
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'users_list_error',
        workspace_id,
        error_message: error.message,
      },
      'Failed to list users'
    )

    return ctx.json(toLicenseError('INTERNAL_ERROR', 500), { status: 500 })
  }
})

/**
 * GET /api/backoffice/users/:user_id
 * Retrieve a specific user
 *
 * Auth: Backoffice staff role required
 * Middleware: License enforcement + tenant resolver
 * Transactions: NO (read-only)
 * Response: User object
 */
backofficeUsersRouter.get(
  '/backoffice/users/:user_id',
  async (ctx: Context) => {
    const correlationId = ctx.get('correlation_id')
    const tenantDb = ctx.get('tenant_db')
    const user_id = ctx.req.param('user_id')

    try {
      // Query user by ID
      const result = await tenantDb.query(
        'SELECT id, name, email, role, status, created_at FROM users WHERE id=$1 LIMIT 1',
        [user_id]
      )

      if (!result.rows.length) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'user_not_found',
            user_id,
            error_code: 'USER_NOT_FOUND',
          },
          'User not found'
        )
        return ctx.json(toLicenseError('USER_NOT_FOUND', 404), { status: 404 })
      }

      const user = result.rows[0]

      logger.debug(
        {
          correlation_id: correlationId,
          action: 'user_retrieved',
          user_id,
        },
        'User retrieved'
      )

      return ctx.json(
        {
          success: true,
          data: user,
          error: null,
        },
        { status: 200 }
      )
    } catch (error: any) {
      logger.error(
        {
          correlation_id: correlationId,
          action: 'user_get_error',
          user_id,
          error_message: error.message,
        },
        'Failed to retrieve user'
      )

      return ctx.json(toLicenseError('INTERNAL_ERROR', 500), { status: 500 })
    }
  }
)

/**
 * PATCH /api/backoffice/users/:user_id/soft-delete
 * Soft-delete a user (mark as DISABLED, not counted toward limits)
 *
 * Auth: Backoffice staff role required
 * Middleware: License enforcement + tenant resolver
 * Transactions: YES (UPDATE user)
 * Idempotency: NO (idempotent by design; second call is no-op)
 * Response: Updated user object or 404
 */
backofficeUsersRouter.patch(
  '/backoffice/users/:user_id/soft-delete',
  async (ctx: Context) => {
    const correlationId = ctx.get('correlation_id')
    const tenantDb = ctx.get('tenant_db')
    const user_id = ctx.req.param('user_id')

    try {
      // Update user status to DISABLED (soft-delete)
      const result = await tenantDb.query(
        'UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, email, role, status',
        ['DISABLED', user_id]
      )

      if (!result.rows.length) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'user_soft_delete_not_found',
            user_id,
            error_code: 'USER_NOT_FOUND',
          },
          'User not found for soft-delete'
        )
        return ctx.json(toLicenseError('USER_NOT_FOUND', 404), { status: 404 })
      }

      const user = result.rows[0]

      logger.info(
        {
          correlation_id: correlationId,
          action: 'user_soft_deleted',
          user_id,
          role: user.role,
        },
        'User soft-deleted (no longer counted toward limits)'
      )

      return ctx.json(
        {
          success: true,
          data: {
            ...user,
            message: 'User disabled and no longer counted toward limits',
          },
          error: null,
        },
        { status: 200 }
      )
    } catch (error: any) {
      logger.error(
        {
          correlation_id: correlationId,
          action: 'user_soft_delete_error',
          user_id,
          error_message: error.message,
        },
        'Failed to soft-delete user'
      )

      return ctx.json(toLicenseError('INTERNAL_ERROR', 500), { status: 500 })
    }
  }
)

export default backofficeUsersRouter

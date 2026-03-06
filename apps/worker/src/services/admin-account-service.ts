/**
 * Admin Account Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Creates initial admin user account for workspace.
 * Generates verification token and sets password hash.
 *
 * Admin Account Setup:
 * - Email: provided by MMC
 * - Role: ADMIN
 * - Password: temporary, not sent (TODO: should use secure setup link)
 * - Email verified: false (admin must verify email)
 */

import * as crypto from 'crypto'
import type { Pool } from 'pg'

/**
 * Admin Account Creation Result
 */
export interface AdminAccountResult {
  success: boolean
  userId?: string
  email?: string
  verificationToken?: string
  errorMessage?: string
  durationMs?: number
}

/**
 * Admin Account Service
 */
export class AdminAccountService {
  private logger?: any

  constructor(logger?: any) {
    this.logger = logger
  }

  /**
   * Create admin account
   */
  async createAdminAccount(
    pool: Pool,
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<AdminAccountResult> {
    const startTime = Date.now()

    try {
      // Generate temporary password hash
      // In production: should use secure setup link instead
      const tempPassword = this.generateTemporaryPassword()
      const passwordHash = await this.hashPassword(tempPassword)

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex')

      // Get ADMIN role ID
      const roleResult = await pool.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`)

      if (roleResult.rows.length === 0) {
        throw new Error('ADMIN role not found')
      }

      const roleId = roleResult.rows[0].id

      // Update placeholder user with real email
      const result = await pool.query(
        `UPDATE users
         SET email = $1,
             first_name = $2,
             last_name = $3,
             password_hash = $4,
             role_id = $5,
             is_active = true
         WHERE email = 'admin@workspace.local'
         RETURNING id, email`,
        [email, firstName || 'Admin', lastName || 'User', passwordHash, roleId]
      )

      if (result.rows.length === 0) {
        throw new Error('Failed to create admin account')
      }

      const user = result.rows[0]

      this.logger?.logStep('admin-created', 'Admin account created', {
        user_id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
      })

      return {
        success: true,
        userId: user.id,
        email: user.email,
        verificationToken,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'Admin account creation failed',
        error instanceof Error ? error : new Error(errorMsg),
        {
          email,
        }
      )

      return {
        success: false,
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Generate temporary password
   * (In production, use secure setup link instead)
   */
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  /**
   * Hash password using bcrypt (or similar)
   * TODO: Implement proper bcrypt hashing
   */
  private async hashPassword(password: string): Promise<string> {
    // Placeholder: in production, use bcrypt library
    const hash = crypto
      .createHash('sha256')
      .update(password + process.env.PASSWORD_SALT || 'salt')
      .digest('hex')
    return `$2b$12$${hash.substring(0, 53)}` // Mock bcrypt format
  }
}

/**
 * Factory to create admin account service
 */
export function createAdminAccountService(logger?: any): AdminAccountService {
  return new AdminAccountService(logger)
}

/**
 * Authentication Service
 *
 * File: packages/domain-core/src/services/auth.service.ts
 * Task: T029
 * Phase: 5 - Authentication & Session Management
 *
 * Core authentication logic:
 * - authenticateMember: Validate username/password and member status
 * - issueToken: Create JWT with token_version
 * - verifyToken: Validate JWT signature and structure
 *
 * Properties:
 * - Password comparison (bcrypt)
 * - JWT creation with HS256
 * - Token includes issuer, user_id, role_id, token_version
 * - No workspace_id in token (MMC-only)
 */

import { AppError, ErrorCode } from '../errors/index.js'
// @ts-ignore: @zidney/types/mmc.types subpath not declared in packages/types exports field [INFRA-001-DEPS-02]
import { MMCMember } from '@zidney/types/mmc.types'
// @ts-ignore: bcryptjs not declared as dependency of domain-core [INFRA-001-DEPS-01]
import * as bcrypt from 'bcryptjs'
// @ts-ignore: hono/jwt not declared as dependency of domain-core [INFRA-001-DEPS-04]
import { sign, verify } from 'hono/jwt'
// @ts-ignore: postgres not declared as dependency of domain-core [INFRA-001-DEPS-05]
import { Database } from 'postgres'

export interface MMCTokenPayload {
  sub: string // user ID
  issuer: 'mmc'
  role_id: string
  token_version: number
  exp: number
  iat: number
}

/**
 * Auth Service
 */
export class AuthService {
  constructor(
    private db: Database,
    private jwtSecret: string
  ) {}

  /**
   * Authenticate member by username and password
   *
   * Validates:
   * - Member exists
   * - Password matches
   * - Member status is ACTIVE
   * - Member role is ACTIVE
   *
   * Returns member if successful, throws error otherwise
   */
  async authenticateMember(
    username: string,
    password: string
  ): Promise<MMCMember> {
    // Query member by username
    const result = await this.db.query(
      `SELECT m.*, r.status as role_status FROM mmc_members m
       LEFT JOIN roles r ON m.role_id = r.id
       WHERE LOWER(m.username) = LOWER($1)`,
      [username]
    )

    if (result.rowCount === 0) {
      throw new AppError(
        ErrorCode.AUTHENTICATION_FAILED,
        'Invalid username or password',
        401,
        { reason: 'User not found' }
      )
    }

    const member = result.rows[0]

    // Verify member status
    if (member.status !== 'ACTIVE') {
      throw new AppError(
        ErrorCode.MEMBER_DISABLED,
        'Member account is disabled',
        401
      )
    }

    // Verify role status
    if (member.role_status !== 'ACTIVE') {
      throw new AppError(
        ErrorCode.AUTHENTICATION_FAILED,
        'Member role is inactive',
        401
      )
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, member.password_hash)
    if (!passwordMatch) {
      throw new AppError(
        ErrorCode.AUTHENTICATION_FAILED,
        'Invalid username or password',
        401,
        { reason: 'Password mismatch' }
      )
    }

    // Remove password hash before returning
    delete member.password_hash

    return this.augmentMember(member)
  }

  /**
   * Issue JWT token for authenticated member
   *
   * Token includes:
   * - sub: user ID
   * - issuer: 'mmc'
   * - role_id: member's role
   * - token_version: for session invalidation
   * - exp: 1 hour from now
   */
  async issueToken(
    memberId: string,
    roleId: string,
    tokenVersion: number,
    expiresInSeconds: number = 3600
  ): Promise<{ access_token: string; token_type: string; expires_in: number }> {
    const now = Math.floor(Date.now() / 1000)
    const exp = now + expiresInSeconds

    const payload: MMCTokenPayload = {
      sub: memberId,
      issuer: 'mmc',
      role_id: roleId,
      token_version: tokenVersion,
      iat: now,
      exp,
    }

    const token = await sign(payload, this.jwtSecret)

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresInSeconds,
    }
  }

  /**
   * Verify and decode JWT token
   *
   * Validates signature, issuer, and expiration
   */
  async verifyToken(token: string): Promise<MMCTokenPayload> {
    try {
      const payload = (await verify(token, this.jwtSecret)) as MMCTokenPayload

      // Additional validation
      if (payload.issuer !== 'mmc') {
        throw new Error('Invalid issuer')
      }

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired')
      }

      return payload
    } catch (error) {
      throw new AppError(
        ErrorCode.AUTHENTICATION_FAILED,
        'Invalid or expired token',
        401,
        { reason: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  /**
   * Private: Augment member with role name (for response)
   */
  private async augmentMember(member: any): Promise<MMCMember> {
    const roleResult = await this.db.query(
      `SELECT name FROM roles WHERE id = $1`,
      [member.role_id]
    )

    return {
      id: member.id,
      username: member.username,
      email: member.email,
      role_id: member.role_id,
      role_name: roleResult.rows[0]?.name,
      team_id: member.team_id,
      group_id: member.group_id,
      department_id: member.department_id,
      token_version: member.token_version,
      status: member.status,
      created_at: member.created_at,
      updated_at: member.updated_at,
    }
  }
}

/**
 * Create auth service instance
 */
export function createAuthService(
  db: Database,
  jwtSecret: string
): AuthService {
  return new AuthService(db, jwtSecret)
}

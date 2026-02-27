/**
 * Member Service
 *
 * File: packages/domain-core/src/services/member.service.ts
 * Task: T013
 * Phase: 3 - Member Management CRUD
 *
 * Core business logic for MMC member lifecycle:
 * - createMember: Insert new member with hashed password, audit logging
 * - getMember: Retrieve with augmented data (role_name, creator info)
 * - listMembers: Paginated list with filtering
 * - updateMember: Modify email/team/group/department (non-destructive)
 * - disableMember: Soft delete by setting status=DISABLED, increment token_version
 *
 * Properties:
 * - Transactions atomic (all or nothing)
 * - Password hashing (bcrypt)
 * - Validation before DB writes
 * - Audit logging on all operations
 * - Token version cascade (invalidates sessions)
 * - No HTTP logic (services are framework-agnostic)
 */

import { AppError, ErrorCode } from '@zidney/domain-core/errors'
import {
  CreateMemberRequest,
  MMCMember,
  UpdateMemberRequest,
} from '@zidney/types/mmc.types'
import { validatePassword } from '@zidney/validation/password.validator'
// @ts-ignore: bcryptjs not declared as dependency of domain-core [INFRA-001-DEPS-01]
import * as bcrypt from 'bcryptjs'
// @ts-ignore: postgres not declared as dependency of domain-core [INFRA-001-DEPS-05]
import { Database } from 'postgres'
import { v4 as uuidv4 } from 'uuid'
import { AuditService } from './audit.service'

const BCRYPT_COST = 12

/**
 * Member Service
 *
 * All operations are transactional. If any step fails, the entire operation rolls back.
 */
export class MemberService {
  constructor(
    private db: Database,
    _auditService: AuditService
  ) {}

  /**
   * Create a new MMC member
   *
   * Validates:
   * - Username uniqueness
   * - Email uniqueness
   * - Role exists and is ACTIVE
   * - Password complexity
   *
   * Returns created member with augmented data.
   */
  async createMember(
    request: CreateMemberRequest,
    createdBy: string | null,
    correlationId: string,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<MMCMember> {
    // Validate inputs
    if (!request.username || request.username.length < 3) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Username must be at least 3 characters',
        400
      )
    }

    if (!request.email || !this.isValidEmail(request.email)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid email format',
        400
      )
    }

    const passwordValidation = validatePassword(request.password)
    if (!passwordValidation.valid) {
      throw new AppError(
        ErrorCode.INVALID_PASSWORD,
        passwordValidation.errors.join('; '),
        400
      )
    }

    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Check username uniqueness
      const usernameResult = await client.query(
        `SELECT id FROM mmc_members WHERE LOWER(username) = LOWER($1)`,
        [request.username]
      )
      if (usernameResult.rowCount > 0) {
        throw new AppError(
          ErrorCode.DUPLICATE_USERNAME,
          'Username already in use',
          409
        )
      }

      // Check email uniqueness
      const emailResult = await client.query(
        `SELECT id FROM mmc_members WHERE LOWER(email) = LOWER($1)`,
        [request.email]
      )
      if (emailResult.rowCount > 0) {
        throw new AppError(
          ErrorCode.DUPLICATE_EMAIL,
          'Email already in use',
          409
        )
      }

      // Check role exists and is ACTIVE
      const roleResult = await client.query(
        `SELECT id, status FROM roles WHERE id = $1`,
        [request.role_id]
      )
      if (roleResult.rowCount === 0) {
        throw new AppError(ErrorCode.INVALID_ROLE, 'Role not found', 404)
      }
      if (roleResult.rows[0].status !== 'ACTIVE') {
        throw new AppError(
          ErrorCode.INVALID_ROLE,
          'Cannot assign inactive role',
          400
        )
      }

      // Hash password
      const passwordHash = await bcrypt.hash(request.password, BCRYPT_COST)

      // Create member
      const memberId = uuidv4()
      const now = new Date().toISOString()

      const insertResult = await client.query(
        `INSERT INTO mmc_members (
          id, username, email, password_hash, role_id,
          team_id, group_id, department_id,
          status, token_version, created_at, updated_at, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          memberId,
          request.username,
          request.email,
          passwordHash,
          request.role_id,
          request.team_id || null,
          request.group_id || null,
          request.department_id || null,
          'ACTIVE',
          1, // token_version starts at 1
          now,
          now,
          createdBy,
          createdBy,
        ]
      )

      const member = insertResult.rows[0]

      // Audit log
      await client.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id, action_type, entity_type, entity_id,
          previous_state, new_state, correlation_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          createdBy,
          'MEMBER_CREATED',
          'MEMBER',
          memberId,
          null,
          JSON.stringify({
            username: member.username,
            email: member.email,
            role_id: member.role_id,
            status: 'ACTIVE',
          }),
          correlationId,
          ipAddress,
          userAgent,
        ]
      )

      await client.query('COMMIT')

      // Augment with role name
      return this.augmentMember(member, client)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get member by ID
   *
   * Returns augmented member data (role_name, creator info).
   */
  async getMember(memberId: string): Promise<MMCMember | null> {
    const result = await this.db.query(
      `SELECT * FROM mmc_members WHERE id = $1`,
      [memberId]
    )

    if (result.rowCount === 0) {
      return null
    }

    return this.augmentMember(result.rows[0], this.db as any)
  }

  /**
   * List members with pagination
   */
  async listMembers(
    limit: number = 50,
    offset: number = 0,
    status?: 'ACTIVE' | 'DISABLED'
  ): Promise<{ members: MMCMember[]; total: number }> {
    let query = `SELECT * FROM mmc_members`
    const params: unknown[] = []
    const conditions: string[] = []

    if (status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(status)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM mmc_members ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await this.db.query(query, params)
    const members = await Promise.all(
      result.rows.map((m: any) => this.augmentMember(m, this.db as any))
    )

    return { members, total }
  }

  /**
   * Update member (email, team, group, department only)
   *
   * Cannot update: username (immutable), password (separate), role (separate)
   */
  async updateMember(
    memberId: string,
    request: UpdateMemberRequest,
    updatedBy: string,
    correlationId: string,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<MMCMember> {
    // Get current member
    const current = await this.getMember(memberId)
    if (!current) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Member not found', 404)
    }

    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Check email uniqueness if updating
      if (request.email && request.email !== current.email) {
        const emailResult = await client.query(
          `SELECT id FROM mmc_members WHERE LOWER(email) = LOWER($1) AND id != $2`,
          [request.email, memberId]
        )
        if (emailResult.rowCount > 0) {
          throw new AppError(
            ErrorCode.DUPLICATE_EMAIL,
            'Email already in use',
            409
          )
        }
      }

      // Build update query
      const updates: string[] = []
      const values: unknown[] = []
      let paramCount = 1

      if (request.email !== undefined) {
        updates.push(`email = $${paramCount}`)
        values.push(request.email)
        paramCount++
      }

      if (request.team_id !== undefined) {
        updates.push(`team_id = $${paramCount}`)
        values.push(request.team_id || null)
        paramCount++
      }

      if (request.group_id !== undefined) {
        updates.push(`group_id = $${paramCount}`)
        values.push(request.group_id || null)
        paramCount++
      }

      if (request.department_id !== undefined) {
        updates.push(`department_id = $${paramCount}`)
        values.push(request.department_id || null)
        paramCount++
      }

      if (updates.length === 0) {
        // No updates requested
        return current
      }

      updates.push(`updated_at = NOW()`)
      updates.push(`updated_by = $${paramCount}`)
      values.push(updatedBy)

      const updateQuery = `UPDATE mmc_members SET ${updates.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`
      values.push(memberId)

      const updateResult = await client.query(updateQuery, values)
      const updated = updateResult.rows[0]

      // Audit log
      await client.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id, action_type, entity_type, entity_id,
          previous_state, new_state, correlation_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          updatedBy,
          'MEMBER_UPDATED',
          'MEMBER',
          memberId,
          JSON.stringify({
            email: current.email,
            team_id: current.team_id,
            group_id: current.group_id,
            department_id: current.department_id,
          }),
          JSON.stringify({
            email: updated.email,
            team_id: updated.team_id,
            group_id: updated.group_id,
            department_id: updated.department_id,
          }),
          correlationId,
          ipAddress,
          userAgent,
        ]
      )

      await client.query('COMMIT')

      return this.augmentMember(updated, client)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Disable member (soft delete)
   *
   * Sets status=DISABLED and increments token_version to invalidate sessions.
   */
  async disableMember(
    memberId: string,
    disabledBy: string,
    correlationId: string,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<MMCMember> {
    // Get current member
    const current = await this.getMember(memberId)
    if (!current) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Member not found', 404)
    }

    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      const result = await client.query(
        `UPDATE mmc_members
         SET status = 'DISABLED', token_version = token_version + 1, updated_at = NOW(), updated_by = $1
         WHERE id = $2
         RETURNING *`,
        [disabledBy, memberId]
      )

      const updated = result.rows[0]

      // Audit log
      await client.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id, action_type, entity_type, entity_id,
          previous_state, new_state, correlation_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          disabledBy,
          'MEMBER_DISABLED',
          'MEMBER',
          memberId,
          JSON.stringify({
            status: current.status,
            token_version: current.token_version,
          }),
          JSON.stringify({
            status: 'DISABLED',
            token_version: updated.token_version,
          }),
          correlationId,
          ipAddress,
          userAgent,
        ]
      )

      await client.query('COMMIT')

      return this.augmentMember(updated, client)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Verify password hash
   *
   * Used by authentication service
   */
  async verifyPassword(memberId: string, password: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT password_hash FROM mmc_members WHERE id = $1`,
      [memberId]
    )

    if (result.rowCount === 0) {
      return false
    }

    const { password_hash } = result.rows[0]
    return bcrypt.compare(password, password_hash)
  }

  /**
   * Private: Augment member with role_name and creator info
   */
  private async augmentMember(member: any, client: any): Promise<MMCMember> {
    // Get role name
    const roleResult = await (client.query || client.db.query)(
      `SELECT name FROM roles WHERE id = $1`,
      [member.role_id]
    )
    const roleName =
      roleResult.rowCount > 0 ? roleResult.rows[0].name : undefined

    // Get creator username
    let createdByUsername: string | undefined
    if (member.created_by) {
      const creatorResult = await (client.query || client.db.query)(
        `SELECT username FROM mmc_members WHERE id = $1`,
        [member.created_by]
      )
      createdByUsername =
        creatorResult.rowCount > 0 ? creatorResult.rows[0].username : undefined
    }

    return {
      id: member.id,
      username: member.username,
      email: member.email,
      role_id: member.role_id,
      role_name: roleName,
      team_id: member.team_id,
      group_id: member.group_id,
      department_id: member.department_id,
      token_version: member.token_version,
      status: member.status,
      created_at: member.created_at,
      updated_at: member.updated_at,
      created_by: member.created_by,
      created_by_username: createdByUsername,
      updated_by: member.updated_by,
    }
  }

  /**
   * Private: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

/**
 * Create member service instance
 */
export function createMemberService(
  db: Database,
  auditService: AuditService
): MemberService {
  return new MemberService(db, auditService)
}

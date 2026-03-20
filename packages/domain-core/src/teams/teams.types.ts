/**
 * Teams Domain — Types & Interfaces
 *
 * File: packages/domain-core/src/teams/teams.types.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — type definitions only
 * ✓ No framework dependencies
 * ✓ No database imports — DbClient is a structural interface
 */

// ---------------------------------------------------------------------------
// DbClient — structural interface (no pg import in domain layer)
// ---------------------------------------------------------------------------

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// AuditContext
// ---------------------------------------------------------------------------

export interface AuditContext {
  user_id: string
  correlation_id: string
  workspace_slug: string
  workspace_id: string
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TeamStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

// ---------------------------------------------------------------------------
// Row interfaces (mirror DB schema)
// ---------------------------------------------------------------------------

export interface TeamTypeRow {
  id: string
  name: string
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface TeamRow {
  id: string
  name: string
  team_type_id: string | null
  max_members: number | null
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface StaffTeamRow {
  staff_id: string
  team_id: string
  created_at: Date
}

// ---------------------------------------------------------------------------
// Input / Result types — Team Types
// ---------------------------------------------------------------------------

export interface ListTeamTypesInput {
  status?: 'ENABLED' | 'DISABLED'
  limit: number
  cursor?: string
}

export interface ListTeamTypesResult {
  items: TeamTypeRow[]
  total: number
  nextCursor: string | null
}

export interface CreateTeamTypeInput {
  name: string
  description?: string | null
}

export interface UpdateTeamTypeInput {
  name?: string
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
}

// ---------------------------------------------------------------------------
// Input / Result types — Teams
// ---------------------------------------------------------------------------

export interface ListTeamsInput {
  status?: 'ENABLED' | 'DISABLED'
  team_type_id?: string
  limit: number
  cursor?: string
}

export interface ListTeamsResult {
  items: TeamRow[]
  total: number
  nextCursor: string | null
}

export interface CreateTeamInput {
  name: string
  team_type_id?: string | null
  max_members?: number | null
  description?: string | null
}

export interface UpdateTeamInput {
  name?: string
  team_type_id?: string | null
  max_members?: number | null
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
}

// ---------------------------------------------------------------------------
// Input / Result types — Staff Assignments
// ---------------------------------------------------------------------------

export interface ListTeamMembersInput {
  limit: number
  cursor?: string
}

export interface ListTeamMembersResult {
  items: StaffTeamRow[]
  total: number
  nextCursor: string | null
}

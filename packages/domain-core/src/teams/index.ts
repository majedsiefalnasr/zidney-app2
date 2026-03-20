/**
 * Teams Domain — Public Barrel
 *
 * File: packages/domain-core/src/teams/index.ts
 * Stage: STAGE_26_TEAMS
 */

export * from './teams.errors'
export * from './teams.service'
export type {
  AuditContext,
  CreateTeamInput,
  CreateTeamTypeInput,
  DbClient,
  ListTeamMembersInput,
  ListTeamMembersResult,
  ListTeamsInput,
  ListTeamsResult,
  ListTeamTypesInput,
  ListTeamTypesResult,
  StaffTeamRow,
  TeamRow,
  TeamTypeRow,
  UpdateTeamInput,
  UpdateTeamTypeInput,
} from './teams.types'
export { TeamStatus } from './teams.types'

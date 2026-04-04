/**
 * Plans Domain — Public Barrel
 *
 * File: packages/domain-core/src/plans/index.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

export type { PlanErrorCode } from './plans.errors'
export { PLAN_ERROR_HTTP, PlanError } from './plans.errors'
export {
  createPlan,
  deletePlan,
  getPlanById,
  listPlansService,
  updatePlanService,
} from './plans.service'
export type {
  AuditContext,
  BillingType,
  CreatePlanInput,
  DbClient,
  PlanListQuery,
  PlanListResult,
  PlanRecord,
  PlanRow,
  TransactionClient,
  UpdatePlanInput,
} from './plans.types'

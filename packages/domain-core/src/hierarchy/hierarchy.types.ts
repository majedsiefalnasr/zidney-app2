/**
 * Hierarchy Domain — Types & Interfaces
 */

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

export interface AuditContext {
  user_id: string
  correlation_id: string
  workspace_slug: string
  workspace_id: string
}

export enum HierarchyNodeStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

export interface HierarchyNodeRow {
  id: string
  name: string
  parent_id: string | null
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  created_at: Date
  updated_at: Date
}

export interface HierarchyNodeFlatRow extends HierarchyNodeRow {
  depth: number
}

export interface HierarchyNodeTree extends HierarchyNodeFlatRow {
  children: HierarchyNodeTree[]
}

export interface CreateHierarchyNodeInput {
  name: string
  parent_id?: string | null
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
}

export interface UpdateHierarchyNodeInput {
  name?: string
  parent_id?: string | null
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
}

export interface ListHierarchyNodesInput {
  page: number
  per_page: number
  status?: 'ENABLED' | 'DISABLED'
}

export interface ListHierarchyNodesResult {
  items: HierarchyNodeFlatRow[]
  total: number
  page: number
  per_page: number
}

export interface DeleteHierarchyNodeResult {
  deleted: true
}

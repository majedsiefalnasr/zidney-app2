/**
 * Column Definition Types for DataTable
 * Supports both primitive and computed columns with strict typing
 */

import type { VNode } from 'vue'
import type { Accessor } from './common'

// Generic contexts for type-safe rendering
export interface HeaderContext<TRow = any> {
  column: ColumnDef<TRow>
  table: DataTableInstance<TRow>
}

export interface CellContext<TRow = any> {
  row: TRow
  column: ColumnDef<TRow>
  value: any
  table: DataTableInstance<TRow>
}

// Base column definition
export interface ColumnDef<TRow = any> {
  id: string
  header?: string | ((context: HeaderContext<TRow>) => VNode | string)
  accessor?: Accessor<TRow>
  cell?: (context: CellContext<TRow>) => VNode | string
  enableSorting?: boolean
  enableFiltering?: boolean
  enableHiding?: boolean
  size?: number
  minSize?: number
  maxSize?: number
  meta?: Record<string, any>
}

// Discriminated union: Primitive columns may omit accessor (inferred from id)
export type PrimitiveColumnDef<TRow = any> = Omit<ColumnDef<TRow>, 'accessor'> & {
  accessor?: Accessor<TRow>
}

// Discriminated union: Computed columns require explicit accessor
export type ComputedColumnDef<TRow = any> = ColumnDef<TRow> & {
  accessor: Accessor<TRow>
}

// Union for use in component props
export type AnyColumnDef<TRow = any> = PrimitiveColumnDef<TRow> | ComputedColumnDef<TRow>

// Column group for multi-level headers
export interface ColumnGroup<TRow = any> {
  id: string
  header: string
  columns: AnyColumnDef<TRow>[]
}

// Column configuration
export interface ColumnState {
  order: string[] // Column IDs in display order
  visibility: Map<string, boolean>
  sorting: Map<string, 'asc' | 'desc'>
  sizing: Map<string, number>
}

// DataTable instance for context
export interface DataTableInstance<TRow = any> {
  rows: TRow[]
  columns: AnyColumnDef<TRow>[]
  sortState?: { column: string; direction: 'asc' | 'desc' }
  paginationState?: {
    currentPage: number
    pageSize: number
    totalCount: number
  }
  selectedRows?: Map<string, boolean>
}

// Column sizing configuration
export interface ColumnSizing {
  id: string
  size: number
  isResizing?: boolean
}

// Column pinning configuration
export type ColumnPinning = 'left' | 'right' | false

export interface PinnedColumns {
  left: string[]
  right: string[]
}

// Accessor utility types
export type AccessorValue<TRow, TAcc = Accessor<TRow>> = TAcc extends (row: any) => infer V
  ? V
  : TAcc extends string
    ? any
    : never

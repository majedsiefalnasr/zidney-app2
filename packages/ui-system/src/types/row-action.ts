/**
 * Row Action Types for DataTable
 * LOCKED DECISION 2: Async callbacks with component-managed loading
 */

// Row action callback (async-first per LOCKED DECISION 2)
export type RowActionCallback<TRow> = (row: TRow) => Promise<void>

// Row action definition
export interface RowAction<TRow = any> {
  id: string
  label: string
  icon?: string
  callback: RowActionCallback<TRow>
  disabled?: boolean | ((row: TRow) => boolean)
  variant?: 'primary' | 'secondary' | 'destructive'
  confirmation?: {
    title: string
    message: string
    confirmLabel?: string
    isDangerous?: boolean
  }
  tooltip?: string
  requiresConfirmation?: boolean
}

// Row action event (emitted by component per LOCKED DECISION 2)
export interface RowActionStartEvent<TRow = any> {
  actionId: string
  row: TRow
  timestamp: number
}

export interface RowActionEndEvent<TRow = any> {
  actionId: string
  row: TRow
  success: boolean
  error?: Error
  timestamp: number
}

// Row action state management
export interface RowActionState {
  [actionId: string]: boolean // true = loading
}

export interface RowActionStateMap {
  [rowId: string]: RowActionState
}

// Row action result
export interface RowActionResult {
  success: boolean
  error?: Error
  duration: number // milliseconds
}

// Row action configuration
export interface RowActionConfig {
  loadingTimeout?: number
  errorStateDuration?: number // Default 2000ms
  requireConfirmation?: boolean
  showSuccessNotification?: boolean
}

// Row context for action determination
export interface RowContext<TRow = any> {
  row: TRow
  isSelected: boolean
  isLoading: boolean
  index: number
}

// Helper type for action handlers
export type RowActionHandler<TRow> = (row: TRow, action: RowAction<TRow>) => Promise<void>

// Action group for organizing related actions
export interface RowActionGroup<TRow = any> {
  id: string
  label?: string
  actions: RowAction<TRow>[]
}

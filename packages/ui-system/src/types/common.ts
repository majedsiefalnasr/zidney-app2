/**
 * Common Type Definitions for Zidney UI System
 * Shared across all components and utilities
 */

// Filter & Search Types
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty'

export type FilterFieldType = 'text' | 'select' | 'date' | 'boolean' | 'number' | 'multiselect'

export interface FilterField {
  id: string
  label: string
  type: FilterFieldType
  operators: FilterOperator[]
  options?: Array<{ value: any; label: string }>
  placeholder?: string
  description?: string
}

export interface Filter {
  fieldId: string
  operator: FilterOperator
  value: any | [any, any] // [min, max] for 'between'
}

export interface FilterGroup {
  logic: 'and' | 'or'
  filters: Filter[]
  groups?: FilterGroup[]
}

// Sorting Types
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  column: string
  direction: SortDirection
}

// Pagination Types
export interface PaginationState {
  currentPage: number
  pageSize: number
  totalCount: number
}

// Language Types
export interface Language {
  code: string
  name: string
  isDefault?: boolean
  nativeName?: string
}

// Validation Types
export interface ValidationRule {
  type: string
  validate: (value: any) => string | null
  message?: string
}

export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// Selection & State
export type SelectionMode = 'none' | 'single' | 'multiple'

export interface RowSelectionState {
  selectedRows: Map<string, boolean>
  selectAll: boolean
}

// Event Types
export interface EventPayload<T = any> {
  timestamp: number
  source: string
  data?: T
}

// Serialization Types
export interface SerializationOptions {
  compact?: boolean
  includeVersion?: boolean
  encoding?: 'base64' | 'uri'
}

export interface SerializedState {
  version: string
  payload: string
  checksum?: string
}

// Status Types
export type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'archived'
  | 'warning'
  | 'error'
  | 'success'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

// Form Types
export interface FormField {
  name: string
  type: string
  value: any
  error?: string
  required?: boolean
  disabled?: boolean
}

export type FormMode = 'create' | 'edit' | 'view'

// Accessibility
export interface AccessibilityAttributes {
  role?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaRequired?: boolean
  ariaInvalid?: boolean
}

// API Response
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: {
    code: string
    message: string
  } | null
}

// Async State
export type AsyncState = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncOperation<T = any> {
  state: AsyncState
  data: T | null
  error: Error | null
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
}

// Utility Types
export type Accessor<TRow = any> = string | ((row: TRow) => any)

export type CellRenderer<TRow = any> = (props: { value: any; row: TRow; column: any }) => any

export type HeaderRenderer<_TRow = any> = (props: { column: any; table: any }) => any

// Discriminated Unions for Type Safety
export type DataTableViewMode = 'table' | 'grid' | 'list'
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom'

/**
 * Component Props Types for all UI System Components
 * LOCKED DECISIONS embedded in prop types
 */

import type { AnyColumnDef } from './column'
import type {
  ButtonVariant,
  DrawerPosition,
  Filter,
  FilterField,
  Language,
  ModalSize,
  PaginationState,
  SortDirection,
  StatusVariant,
  ValidationRule,
} from './common'
import type { RowAction } from './row-action'

// ===== DataTable Props (LOCKED DECISION 1: Pagination Agnostic) =====
export interface DataTableProps<TRow = any> {
  rows: TRow[]
  columns: AnyColumnDef<TRow>[]
  totalCount: number
  paginationMode: 'server' | 'client' // LOCKED DECISION 1: Mandatory prop
  paginationState: PaginationState
  loading?: boolean
  selectedRows?: string[]
  rowActions?: RowAction<TRow>[]
  sortState?: { column: string; direction: SortDirection }
  filterState?: Filter[]
  enableColumnVisibility?: boolean
  enableRowSelection?: boolean
  enableColumnSorting?: boolean
  enableQuickFilter?: boolean
  allowExport?: boolean
  rowKey?: string | ((row: TRow) => string | number)
}

// ===== AdvancedFilterBuilder Props (LOCKED DECISION 3: URL-primary serialization) =====
export interface AdvancedFilterBuilderProps {
  filters: Filter[]
  availableFields: FilterField[]
  filterSerializationMode: 'url' | 'localStorage' // LOCKED DECISION 3
  maxFilters?: number
  urlRefreshCallback?: () => void
}

// ===== MultiLanguageInputModal Props (LOCKED DECISION 5: Min 1 required language) =====
export interface MultiLanguageInputModalProps {
  isOpen: boolean
  title: string
  languages: Language[]
  requiredLanguages: string[] // Min 1 enforced (LOCKED DECISION 5)
  initialValues?: Record<string, string>
  validationRules?: Record<string, ValidationRule[]>
  filterMode?: 'all' | 'filled' | 'unfilled'
  allowLanguageSearch?: boolean
}

// ===== Layout Components =====
export interface AppLayoutProps {
  logoUrl?: string
  appName: string
  subtitle?: string
}

export interface SidebarLayoutProps {
  items: NavItem[]
  collapsible?: boolean
  defaultCollapsed?: boolean
  activeItem?: string
}

export interface TopBarProps {
  logoUrl?: string
  appName: string
  subtitle?: string
}

export interface NavItem {
  id: string
  label: string
  icon?: string
  href?: string
  disabled?: boolean
  show?: boolean
  badge?: number
  children?: NavItem[]
}

// ===== Form Components =====
export interface DrawerFormLayoutProps {
  isOpen: boolean
  title: string
  subtitle?: string
  isLoading?: boolean
  submitLabel?: string
  cancelLabel?: string
  isDirty?: boolean
  position?: DrawerPosition
}

export interface ModalFormLayoutProps {
  isOpen: boolean
  title: string
  size?: ModalSize
  isLoading?: boolean
  submitLabel?: string
  submitVariant?: ButtonVariant
}

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDangerous?: boolean
}

// ===== Filter Components =====
export interface QuickFilterDropdownProps {
  query: string
  placeholder?: string
  suggestions?: string[]
  debounceMs?: number
}

export interface ColumnVisibilityDropdownProps {
  availableColumns: Array<{ id: string; label: string }>
  visibleColumns: string[]
  hideSelectAll?: boolean
}

// ===== Status Components =====
export interface StatusToggleProps {
  modelValue: boolean
  disabled?: boolean
  label?: string
}

export interface BadgeStatusProps {
  status: StatusVariant
  label: string
  icon?: string
}

export interface StatsCardProps {
  title: string
  value: string | number
  unit?: string
  trend?: { direction: 'up' | 'down'; percentage: number }
  icon?: string
  isLoading?: boolean
}

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: string
  primaryAction?: { label: string; href?: string }
  secondaryAction?: { label: string; href?: string }
}

export interface LoadingStateProps {
  message?: string
  fullHeight?: boolean
}

export interface PaginationBarProps {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  isLoading?: boolean
  disabled?: boolean
}

// ===== Generic Component Props =====
export interface DialogProps {
  isOpen: boolean
  title?: string
  size?: ModalSize
}

export interface InputProps {
  modelValue: string | number
  type?: 'text' | 'email' | 'password' | 'number' | 'date'
  placeholder?: string
  disabled?: boolean
  error?: string
  required?: boolean
  autocomplete?: string
}

export interface SelectProps {
  modelValue: string | number | string[]
  options: Array<{ value: any; label: string }>
  placeholder?: string
  disabled?: boolean
  multiple?: boolean
  searchable?: boolean
}

export interface ButtonProps {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  disabled?: boolean
  icon?: string
}

// ===== Composite Component Props =====
export interface TableActionBarProps {
  hasSelection: boolean
  selectedCount: number
  isLoading?: boolean
  allowExport?: boolean
  allowDelete?: boolean
}

// Type-safe prop extraction
export type ExtractProps<T extends { $$props?: any }> = T extends {
  $$props: infer P
}
  ? P
  : never

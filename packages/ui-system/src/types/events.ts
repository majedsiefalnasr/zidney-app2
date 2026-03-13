/**
 * Event Payload Types for UI System Components
 * Covers all @emit events from components
 */

import type { Filter, SortDirection } from './common'
import type { RowActionEndEvent, RowActionStartEvent } from './row-action'

// ===== DataTable Events =====
export interface DataTablePaginationChangedEvent {
  page: number
  pageSize: number
}

export interface DataTableSortChangedEvent {
  column: string
  direction: SortDirection
}

export interface DataTableFilterChangedEvent {
  filters: Filter[]
}

export interface DataTableRowSelectedEvent {
  rows: string[]
  allSelected: boolean
}

export interface DataTableExportTriggeredEvent {
  format: 'csv' | 'excel' | 'json'
  filters?: Filter[]
}

export interface DataTableQuickFilterChangedEvent {
  query: string
}

export interface DataTableColumnVisibilityChangedEvent {
  visibleColumns: string[]
}

// Row actions (LOCKED DECISION 2: @action-start and @action-end required)
export type DataTableActionStartEvent<TRow = unknown> = RowActionStartEvent<TRow>
export type DataTableActionEndEvent<TRow = unknown> = RowActionEndEvent<TRow>

// ===== AdvancedFilterBuilder Events (LOCKED DECISION 3: storage-fallback) =====
export interface AdvancedFilterBuilderFiltersChangedEvent {
  filters: Filter[]
  serialized: string
}

export interface AdvancedFilterBuilderFilterOverflowEvent {
  suggestedMode: 'localStorage'
}

export interface AdvancedFilterBuilderStorageFallbackTriggeredEvent {
  reason: 'url-overflow' | 'manual'
}

export interface AdvancedFilterBuilderSerializationErrorEvent {
  reason: string
}

// ===== MultiLanguageInputModal Events (LOCKED DECISION 5: validation contract) =====
export interface MultiLanguageInputModalSaveEvent {
  values: Record<string, string>
}

export interface MultiLanguageInputModalValidationChangedEvent {
  isValid: boolean
  validationErrors: Record<string, string[]>
  filledLanguages: Set<string>
  coverage: number
}

// ===== Form Component Events =====
// Use `unknown` for empty event payloads to avoid `{}` banned-type
export type DrawerFormLayoutSubmitEvent = unknown

export interface DrawerFormLayoutCancelEvent {
  isDirty: boolean
}

// Use `unknown` for empty event payloads to avoid `{}` banned-type
export type ModalFormLayoutSubmitEvent = unknown

export type ConfirmDialogConfirmEvent = unknown

// ===== Filter Component Events =====
export interface QuickFilterDropdownQueryChangedEvent {
  query: string
}

export interface QuickFilterDropdownSuggestionSelectedEvent {
  value: string
}

export interface ColumnVisibilityDropdownVisibilityChangedEvent {
  visibleColumns: string[]
}

// ===== Status Component Events =====
export interface StatusToggleUpdateEvent {
  value: boolean
}

export interface PaginationBarPageChangedEvent {
  page: number
}

export interface PaginationBarPageSizeChangedEvent {
  pageSize: number
}

export type EmptyStatePrimaryActionClickedEvent = unknown

export type EmptyStateSecondaryActionClickedEvent = unknown

// ===== Generic Event Payload =====
export interface BaseEventPayload {
  timestamp: number
  source: string
}

export interface ErrorEventPayload extends BaseEventPayload {
  error: Error | string
  code?: string
}

// Event emitter type-safe wrapper
export type EmitFn<T extends { [key: string]: unknown[] }> = <K extends keyof T>(
  event: K,
  ...args: T[K]
) => void

// Common emit signatures
export interface ComponentEmitsMap {
  'update:modelValue': [value: unknown]
  'pagination-changed': [event: DataTablePaginationChangedEvent]
  'sort-changed': [event: DataTableSortChangedEvent]
  'filter-changed': [event: DataTableFilterChangedEvent]
  'row-selected': [event: DataTableRowSelectedEvent]
  'action-start': [event: RowActionStartEvent]
  'action-end': [event: RowActionEndEvent]
  'export-triggered': [event: DataTableExportTriggeredEvent]
  'quick-filter-changed': [event: DataTableQuickFilterChangedEvent]
  'column-visibility-changed': [event: DataTableColumnVisibilityChangedEvent]
  'filters-changed': [event: AdvancedFilterBuilderFiltersChangedEvent]
  'filter-overflow': [event: AdvancedFilterBuilderFilterOverflowEvent]
  'storage-fallback-triggered': [event: AdvancedFilterBuilderStorageFallbackTriggeredEvent]
  'serialization-error': [event: AdvancedFilterBuilderSerializationErrorEvent]
  save: [event: MultiLanguageInputModalSaveEvent]
  cancel: []
  'validation-changed': [event: MultiLanguageInputModalValidationChangedEvent]
  submit: []
}

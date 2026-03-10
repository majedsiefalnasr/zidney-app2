# Zidney UI System – Component API Reference

**Version:** 1.0.0 | **Status:** Production Ready

---

## Overview

The Zidney UI System (@zidney/ui-system) provides a collection of reusable, composable Vue 3
components and utilities for building data-driven applications. All components embrace white-label
design, following ADR-0003 principles.

---

## Core Components

### DataTable

Generic, pagination-agnostic data table component (LOCKED DECISION 1).

```typescript
export interface DataTableProps<TRow = any> {
  rows: TRow[];
  columns: AnyColumnDef<TRow>[];
  totalCount: number;
  paginationMode: "server" | "client"; // Mandatory
  paginationState: PaginationState;
  loading?: boolean;
  selectedRows?: string[];
  rowActions?: RowAction<TRow>[];
  sortState?: { column: string; direction: "asc" | "desc" };
  filterState?: Filter[];
  enableColumnVisibility?: boolean;
  enableRowSelection?: boolean;
  enableColumnSorting?: boolean;
  enableQuickFilter?: boolean;
  allowExport?: boolean;
  rowKey?: string | ((row: TRow) => string | number);
}
```

**Events:**

- `@pagination-changed`: { page: number; pageSize: number }
- `@sort-changed`: { column: string; direction: 'asc' | 'desc' }
- `@filter-changed`: { filters: Filter[] }
- `@row-selected`: { rows: string[] }
- `@action-start`: { actionId: string; row: TRow }
- `@action-end`: { actionId: string; row: TRow; success: boolean; error?: Error }

**Example:**

```vue
<template>
  <DataTable
    :rows="users"
    :columns="columns"
    :total-count="totalUsers"
    pagination-mode="server"
    :pagination-state="{ currentPage: 1, pageSize: 10, totalCount: totalUsers }"
    :row-actions="[{ id: 'edit', label: 'Edit', callback: editUser }]"
    @pagination-changed="onPageChange"
    @action-end="onActionEnd"
  />
</template>
```

---

### AdvancedFilterBuilder

Multi-filter UI with URL overflow detection (LOCKED DECISION 3).

```typescript
interface AdvancedFilterBuilderProps {
  filters: Filter[];
  availableFields: FilterField[];
  filterSerializationMode: "url" | "localStorage";
  maxFilters?: number;
}
```

**Events:**

- `@filter-changed`: { filters: Filter[] }
- `@storage-fallback-triggered`: { reason: 'overflow' | 'unavailable' }

---

### MultiLanguageInputModal

Form modal with per-language validation (LOCKED DECISION 5: Min 1 required language).

```typescript
interface MultiLanguageInputModalProps {
  isOpen: boolean;
  title: string;
  languages: Language[];
  requiredLanguages: string[]; // Min 1 enforced
  initialValues?: Record<string, string>;
  validationRules?: Record<string, ValidationRule[]>;
}
```

---

### Layout Components

- **AppLayout**: Root layout (slots: topbar, sidebar, footer)
- **SidebarLayout**: Collapsible sidebar with nav items
- **TopBar**: Header with branding

---

### Form Components

- **DrawerFormLayout**: Slide-in drawer (slots: header, content, footer)
- **ModalFormLayout**: Centered modal (sizes: sm, md, lg, xl)
- **ConfirmDialog**: Confirmation modal (variants: default, dangerous)

---

### Status & Pagination

- **BadgeStatus**: Status badge (variants: active, inactive, pending, archived, warning)
- **StatusToggle**: Toggle switch with animation
- **PaginationBar**: Pagination controls
- **StatsCard**: Metric card with trend indicator
- **EmptyState**: Placeholder for no data
- **LoadingState**: Loading skeleton

---

## Composables

### useFilterBuilder()

Reactive filter state management.

```typescript
const {
  filters,
  addFilter,
  removeFilter,
  serializeFilters,
  deserializeFilters,
  isOverflowed,
  isPersistedExternally,
  toggleStorageFallback,
} = useFilterBuilder([]);
```

### usePagination()

Pagination state (server/client mode agnostic).

```typescript
const {
  currentPage,
  pageSize,
  totalCount,
  totalPages,
  isFirstPage,
  isLastPage,
  nextPage,
  previousPage,
  goToPage,
} = usePagination();
```

### useColumnVisibility()

Column visibility persistence.

```typescript
const { visibleColumns, toggleColumn, showAll, hideAll, isColumnVisible } = useColumnVisibility(
  ["id", "name", "email"],
  { persistToLocalStorage: true },
);
```

### useMultiLanguageForm()

Multi-language form validation.

```typescript
const {
  currentLanguage,
  requiredLanguages,
  isValid,
  setLanguageValue,
  getLanguageValue,
  getAllValues,
  validateLanguage,
  switchLanguage,
} = useMultiLanguageForm(["en", "es"], "en", {
  requiredLanguages: ["en"],
  validationRules: { en: [{ type: "required", message: "Required" }] },
});
```

---

## Utility Functions

### Filter Serialization

```typescript
serializeFilters(filters: Filter[]): string
deserializeFilters(encoded: string): Filter[]
detectFilterOverflow(serialized: string): boolean // > 2000 chars
```

### Table Helpers

```typescript
extractRowKey(row: any, accessor: string | ((r: any) => any)): string | number
paginateRows(rows: any[], page: number, pageSize: number): any[]
sortRows(rows: any[], column: string, direction: 'asc' | 'desc'): any[]
calculateTotalPages(totalCount: number, pageSize: number): number
```

### URL Sync

```typescript
serializeQueryState(state: Partial<TableState>): URLSearchParams
deserializeQueryState(params: URLSearchParams): Partial<TableState>
```

---

## Performance SLOs

- **Component Render:** < 16ms
- **Pagination Change:** < 100ms
- **Filter Serialization:** < 50ms
- **Row Action Callback:** < 2s (timeout)

All components use CSS scoping (`<style scoped>`) and support tree-shaking.

---

## Locked Decisions (Embedded)

1. **Pagination Agnostic:** `paginationMode: 'server' | 'client'` (mandatory)
2. **Async Row Actions:** All actions are `(row) => Promise<void>`
3. **URL-Primary Filters:** Serialization with localStorage fallback
4. **Column Accessor:** Optional for primitives, required for computed
5. **Multi-Language Min 1:** At least 1 required language enforced

---

**For migration guide, see:** [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

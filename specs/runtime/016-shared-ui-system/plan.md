# STAGE 16 – Shared UI System – Technical Design Plan

**Phase:** 02_PLATFORM_MMC  
**Stage:** STAGE_16_SHARED_UI_SYSTEM  
**Plan Status:** LOCKED ARCHITECTURAL DECISIONS EMBEDDED  
**Date:** 2026-02-19

---

## Stage Alignment

**Phase:** 2 – Platform MMC  
**Stage:** 16 – Shared UI System  
**Related Spec File:** specs/phases/02_PLATFORM_MMC/STAGE_16_SHARED_UI_SYSTEM.md  
**Related ADRs:**

- ADR-0003 (White-Label Scope is Visual Only)
- ADR-0008 (Formalize Semantic Versioning Policy)
- ADR-0009 (Rate Limiting)

---

## Architectural Scope Confirmation

✅ **No cross-tenant data access** — UI system contains no tenant-aware logic; tenant context
managed entirely by consuming apps

✅ **No middleware bypass** — Apps handle license enforcement before passing data to UI components

✅ **No direct DB instantiation** — UI system has zero database imports or assumptions

✅ **No grading logic** — Attempt engine protection preserved; grading validation delegated to
domain-core

✅ **No snapshot integrity weakening** — Filter serialization is stateless; snapshot restoration app
responsibility

✅ **No version enforcement weakening** — UI system version-agnostic; version compatibility enforced
by consuming app

✅ **No layer boundary violation** — UI system strictly UI-only; no business logic, no API calls, no
app imports

---

## SECTION 1: LOCKED ARCHITECTURAL DECISIONS

### Decision 1: DataTable Pagination – Agnostic Strategy (Option C)

**LOCKED DECISION:** DataTable pagination strategy is **application-agnostic**.

**Design Implication:**

The `DataTable` component accepts a `paginationMode` prop that can be set to either `'server'` or
`'client'` per consuming application. The component itself implements **neither** server-side nor
client-side pagination exclusively.

- **Server-side mode:** DataTable is stateless regarding page transitions. Parent app manages
  `currentPage` state, total count, fetching, and row updates.
- **Client-side mode:** DataTable receives all rows upfront and manages pagination internally via
  computed properties.

**Component Responsibility:**

- Render pagination controls
- Emit `@pagination-changed` event with `{ page: number; pageSize: number }`
- Accept reactive `paginationState: { currentPage: number; totalCount: number; pageSize: number }`
- Delegate data fetching to parent application

**Constraint:** DataTable must accept a `disabled` prop on pagination controls when data is being
fetched (loading state managed by parent).

---

### Decision 2: Row Actions – Async Callbacks with Component-Managed Loading (Option B)

**LOCKED DECISION:** Row actions are **async-first** with component-managed loading state.

**Design Implication:**

Each row action is defined as an async callback function. The component is responsible for managing
local loading state (visual feedback) while the callback executes.

**Component Contract:**

- Row action definition:
  `{ id: string; label: string; icon?: string; callback: (row: TRow) => Promise<void>; disabled?: boolean; variant?: 'primary' | 'destructive' }`
- Row action execution triggers:
  - `@action-start` event (with action ID and row data)
  - Button enters loading state (`v-loading` directive or disabled + spinner)
  - Callback awaited
  - `@action-end` event (with action ID, row data, success boolean, error if applicable)
  - Button exits loading state

**Component Guarantee:** The component will NOT automatically retry, refetch data, or mutate any
state. Parent app receives events and implements desired behavior.

**Error Handling:** If callback rejects, error is emitted via `@action-end` event. Component shows
error state (visual indicator on button) for 2 seconds, then resets.

---

### Decision 3: Filter Serialization – URL Primary with localStorage Fallback + Visibility Flag (Option B Modified)

**LOCKED DECISION:** Filter serialization strategy is **URL-primary with localStorage fallback**.

**Design Implication:**

The `AdvancedFilterBuilder` and filter consumption system follow this hierarchy:

1. **Primary:** URL query params (`?filters=...` encoded as compact JSON + base64)
2. **Fallback:** localStorage key `{workspaceSlug}:filter-state`
3. **Indicator:** Component exposes `isPersistedExternally` computed property OR emits
   `@storage-fallback-triggered` event

**AdvancedFilterBuilder Responsibility:**

- Accept `filters: Filter[]` and `filterSerializationMode: 'url' | 'localStorage'`
- Expose method `serializeFilters(): string` (compact Base64-encoded JSON)
- Expose method `deserializeFilters(encoded: string): Filter[]` with validation
- Detect **URL overflow:** If serialized filter string exceeds 2000 characters, component is
  disabled and emits `@filter-overflow { suggestedMode: 'localStorage' }`
- When overflow detected and user switches to localStorage, emit
  `@storage-fallback-triggered { reason: 'url-overflow' }`
- Compute `isPersistedExternally` property that returns `true` when localStorage is active

**URL Overflow Detection Logic:**

- Attempt to encode current filter state
- If encoded length > 2000 chars, trigger overflow state
- Display warning in UI: "Filters are too complex for URL. Please reduce filter count or switch to
  session storage."

**Constraint:** Apps must manually sync URL and localStorage. UI system provides
serialization/deserialization utilities only.

---

### Decision 4: Column Accessor – Optional for Primitives, Required for Computed (Option A)

**LOCKED DECISION:** Column accessors follow a **conditional requirement model**.

**Design Implication:**

Column definitions accept an `accessor` property with different requirements based on column type:

- **Primitive columns** (data from flat object properties): `accessor` is **optional**
  - If omitted, component infers accessor from `id` property (e.g., `id: 'email'` → accessor is
    `row => row.email`)
  - Type: `string` (property path, supports dot notation: `'user.email'`)

- **Computed columns** (derived/transformed data): `accessor` is **required**
  - Type: `(row: TRow) => any`
  - Component does NOT infer accessors for computed columns
  - Example: `{ id: 'fullName', header: 'Name', accessor: row => \`\${row.firstName}
    \${row.lastName}\` }`

**Column Definition Type Hierarchy:**

```
ColumnDef<TRow> = {
  id: string
  header: string | ((context: HeaderContext) => VNode)
  accessor?: string | ((row: TRow) => any)  // Optional for primitives
  cell?: (context: CellContext<TRow>) => VNode
  enableSorting?: boolean
  enableFiltering?: boolean
  enableHiding?: boolean
  size?: number
}

PrimitiveColumnDef<TRow> = ColumnDef<TRow> & {
  // accessor is inferred from id if omitted
}

ComputedColumnDef<TRow> = ColumnDef<TRow> & {
  accessor: (row: TRow) => any  // REQUIRED
}
```

**Type Safety:** TypeScript strict mode ensures computed columns fail to compile if accessor is
omitted.

---

### Decision 5: Multi-Language Validation – Per-Language with Minimum 1 Required (Option B Constrained)

**LOCKED DECISION:** Multi-language validation enforces **per-language constraints with minimum 1
required language**.

**Design Implication:**

The `MultiLanguageInputModal` component validates each language field independently and enforces a
global constraint: at least one language must have content.

**Validation Architecture:**

- Accept prop `validationRules: { [languageCode: string]: ValidationRule[] }`
- Each language input runs language-specific validation rules (e.g., max length, pattern matching)
- Global constraint: `requiredLanguages.length >= 1` (configurable list of languages that must
  contain content)
- Component computes `isValid: boolean` that returns `false` if any language fails validation OR if
  fewer than 1 required languages have content

**Validation Event Contract:**

- Emit
  `@validation-changed { isValid: boolean; validationErrors: { [language: string]: string[] } }`
- Parent app controls submit button enabled state based on `isValid`

**Constraint:** If `requiredLanguages` array is empty, component must throw a warning and default to
at least 1 language required.

---

## SECTION 2: COMPONENT IMPLEMENTATION ARCHITECTURE

### 2.1 DataTable Architecture

**Component Name:** `DataTable.vue`  
**Generic Type:** `DataTable<TRow>`  
**Props:**

```
- rows: TRow[]
- columns: ColumnDef<TRow>[]
- totalCount: number  // For server-side pagination
- paginationMode: 'server' | 'client'  // LOCKED DECISION 1
- paginationState: { currentPage: number; pageSize: number }
- loading: boolean
- selectedRows: string[]  // Row IDs selected
- rowActions: RowAction<TRow>[]  // LOCKED DECISION 2
- sortState: { column: string; direction: 'asc' | 'desc' }
- filterState: Filter[] (optional)
- enableColumnVisibility: boolean
- enableRowSelection: boolean
- enableColumnSorting: boolean
- enableQuickFilter: boolean (shows search box)
- allowExport: boolean
```

**Events:**

```
@pagination-changed { page: number; pageSize: number }
@sort-changed { column: string; direction: 'asc' | 'desc' }
@filter-changed { filters: Filter[] }
@row-selected { rows: string[] }
@row-action-click { actionId: string; row: TRow }
@action-start { actionId: string; row: TRow }  // LOCKED DECISION 2
@action-end { actionId: string; row: TRow; success: boolean; error?: Error }  // LOCKED DECISION 2
@export-triggered
@quick-filter-changed { query: string }
@column-visibility-changed { visibleColumns: string[] }
```

**Internal State Management (Composed):**

- Use composition API with `ref()` and `computed()` for row action loading states
- Maintain per-row loading status: `Map<rowId, { action: Map<actionId, boolean> }>`
- Computed `isRowLoading(rowId): boolean` that checks if any action is running
- Computed `isActionLoading(rowId, actionId): boolean` for individual action visual feedback

**Lifecycle:**

1. Rows received via prop
2. If `paginationMode === 'server'`, respect `paginationState` prop and do NOT paginate locally
3. If `paginationMode === 'client'`, use `computed()` to slice rows based on `paginationState`
4. Render rows with actions
5. On row action click:
   - Emit `@action-start`
   - Set local loading state for that row-action combo
   - Await callback
   - Emit `@action-end`
   - Clear loading state
   - Show 2-second error indicator if callback rejected

---

### 2.2 AdvancedFilterBuilder Architecture

**Component Name:** `AdvancedFilterBuilder.vue`  
**Props:**

```
- filters: Filter[]
- availableFields: FilterField[]  // { id, label, type, operators }
- filterSerializationMode: 'url' | 'localStorage'
- urlRefreshCallback?: () => void  // Optional; app can provide
- maxFilters?: number (default: 10)
```

**Events:**

```
@filters-changed { filters: Filter[]; serialized: string }
@filter-overflow { suggestedMode: 'localStorage' }
@storage-fallback-triggered { reason: 'url-overflow' | 'manual' }
@serialization-error { reason: string }
```

**Computed Properties:**

```
isPersistedExternally: boolean  // Returns true if using localStorage
isOverflowed: boolean  // True if serialized length > 2000 chars
overflowSize: number  // Serialized string length
```

**Methods:**

```
serializeFilters(): string
  // Returns Base64-encoded JSON of filter array
  // Throws if invalid

deserializeFilters(encoded: string): Filter[]
  // Decodes and validates filter array
  // Throws validation error with details

checkUrlOverflow(): boolean
  // Tests current filters; returns true if > 2000 chars

triggerStorageFallback(): void
  // Emits storage-fallback-triggered event
  // Switches internal mode to localStorage
```

**URL Overflow Detection Flow:**

1. On `filters` prop change, compute serialized string length
2. If length > 2000:
   - Set `isOverflowed = true`
   - Disable "Add Filter" button
   - Display warning banner
   - Emit `@filter-overflow`
3. User can manually invoke `triggerStorageFallback()` (via app layer)
4. Component switches to localStorage mode internally
5. Emit `@storage-fallback-triggered { reason: 'url-overflow' }`

**Filter State Serialization:**

- Compact format: `{ filters: [{f: 'id', op: 'eq', v: '123'}] }` (abbreviated keys)
- Base64 encode entire JSON
- Prepend with version marker: `v1:` (for future schema changes)
- Final format: `v1:eyJmaWx0ZXJzIjogW3siZiI6ICJpZCIsICJvcCI6ICJlcSIsICJ2IjogIjEyMyJ9XX0=`

---

### 2.3 MultiLanguageInputModal Architecture

**Component Name:** `MultiLanguageInputModal.vue`  
**Props:**

```
- isOpen: boolean
- title: string
- languages: { code: string; name: string; isDefault: boolean }[]
- requiredLanguages: string[]  // LOCKED DECISION 5
- initialValues: { [languageCode: string]: string }
- validationRules: { [languageCode: string]: ValidationRule[] }  // Optional
- filterMode: 'all' | 'filled' | 'unfilled'
- allowLanguageSearch: boolean
```

**Events:**

```
@save { values: { [languageCode: string]: string } }
@cancel
@validation-changed { isValid: boolean; validationErrors: { [language: string]: string[] } }  // LOCKED DECISION 5
```

**Computed Properties:**

```
isValid: boolean
  // true if:
  //   1. Default language has content
  //   2. ALL requiredLanguages have content (min. 1)
  //   3. All custom validation rules pass per language

filledLanguages: Set<string>
  // Languages with non-empty input

unfilled Languages: Set<string>
  // Languages with empty input

translationCoverage: number
  // Percent of languages with content (0-100)
```

**Validation Logic:**

```
validateLanguage(code: string): { isValid: boolean; errors: string[] }
  // Runs all validationRules for language
  // Returns field-level errors

validateGlobal(): { isValid: boolean; errors: string[] }
  // Checks:
  //   - Default language not empty
  //   - requiredLanguages.length >= 1
  //   - All requiredLanguages have content
  // Returns component-level errors

applyFilterMode(mode: 'all' | 'filled' | 'unfilled'): void
  // Controls which language tabs are visible
  // 'all' → show all languages
  // 'filled' → show only languages with content
  // 'unfilled' → show only languages without content
```

**Constraint Enforcement:**

- If `requiredLanguages.length === 0`, log warning: "No required languages specified. Defaulting to
  minimum 1 required language."
- If default language is empty, always show error: "Default language is required."
- If any language in `requiredLanguages` is empty, show specific error: "Required language '{name}'
  must have content."

---

### 2.4 Layout Components Architecture

**Component Set:**

- `AppLayout.vue` (root layout wrapper)
- `SidebarLayout.vue` (collapsible sidebar + content)
- `TopBar.vue` (namespace/workspace header + user menu slot)

**AppLayout Contract:**

```
Props:
- logoUrl?: string  // White-label customization
- appName?: string
- slots: default (content), sidebar, topbar, footer

Structure:
<AppLayout>
  <template #topbar>
    <TopBar :logoUrl="logoUrl" :appName="appName" />
  </template>
  <template #sidebar>
    <SidebarLayout :items="navigationItems" />
  </template>
  <template #default>
    <!-- Main content goes here -->
  </template>
</AppLayout>
```

**SidebarLayout Contract:**

```
Props:
- items: NavItem[]  // { id, label, icon, href, disabled?, show? }
- collapsible: boolean
- defaultCollapsed: boolean
- activeItem?: string

Events:
@item-clicked { itemId: string }
@collapse-toggled { isCollapsed: boolean }

Slot:
- default: Additional sidebar content
- footer: Sticky footer content
```

**TopBar Contract:**

```
Props:
- logoUrl?: string
- appName: string
- subtitle?: string

Slots:
- default: Right-side content (user menu, notifications, etc.)
```

---

### 2.5 Filter Consumption Components

**QuickFilterDropdown.vue:**

```
Props:
- query: string
- placeholder: string
- suggestions?: string[]
- debounceMs: number (default: 300)

Events:
@query-changed { query: string }
@suggestion-selected { value: string }
```

**ColumnVisibilityDropdown.vue:**

```
Props:
- availableColumns: { id: string; label: string }[]
- visibleColumns: string[]
- hideSelectAll?: boolean

Events:
@visibility-changed { visibleColumns: string[] }
```

---

### 2.6 Modal and Form Components

**DrawerFormLayout.vue:**

```
Props:
- isOpen: boolean
- title: string
- subtitle?: string
- isLoading?: boolean
- submitLabel?: string
- cancelLabel?: string
- isDirty?: boolean

Events:
@submit
@cancel
@close

Slots:
- default: Form content
- footer: Custom footer (optional)
```

**ModalFormLayout.vue:**

```
Props:
- isOpen: boolean
- title: string
- size: 'sm' | 'md' | 'lg' | 'xl'
- isLoading?: boolean
- submitLabel?: string
- submitVariant?: 'primary' | 'destructive'

Events:
@submit
@cancel

Slots:
- default: Form content
```

**ConfirmDialog.vue:**

```
Props:
- isOpen: boolean
- title: string
- message: string
- confirmLabel?: string
- cancelLabel?: string
- isDangerous?: boolean  // Turns confirm to red

Events:
@confirm
@cancel
```

---

### 2.7 Status and Display Components

**StatusToggle.vue:**

```
Props:
- modelValue: boolean
- disabled?: boolean
- label?: string

Events:
@update:modelValue { value: boolean }

Use Case: Enable/disable entities (roles, agents, etc.)
```

**BadgeStatus.vue:**

```
Props:
- status: 'active' | 'inactive' | 'pending' | 'archived' | 'warning'
- label: string
- icon?: string

Features: Color-coded status indicators
```

**StatsCard.vue:**

```
Props:
- title: string
- value: string | number
- unit?: string
- trend?: { direction: 'up' | 'down'; percentage: number }
- icon?: string
- isLoading?: boolean

Use Case: Display metrics on dashboard
```

**EmptyState.vue:**

```
Props:
- title: string
- description?: string
- icon?: string
- primaryAction?: { label: string; href?: string }
- secondaryAction?: { label: string; href?: string }

Events:
@primary-action-clicked
@secondary-action-clicked
```

**LoadingState.vue:**

```
Props:
- message?: string
- fullHeight?: boolean

Use Case: CLS-safe loading placeholder
```

**PaginationBar.vue:**

```
Props:
- currentPage: number
- totalPages: number
- totalCount: number
- pageSize: number
- isLoading?: boolean
- disabled?: boolean

Events:
@page-changed { page: number }
@page-size-changed { pageSize: number }
```

---

## SECTION 3: FILE STRUCTURE AND DIRECTORY LAYOUT

```
packages/ui-system/
├── src/
│   ├── index.ts                    # Main export barrel
│   ├── types/
│   │   ├── index.ts                # Type barrel
│   │   ├── common.ts               # Common types (Filter, Operator, etc.)
│   │   ├── column.ts               # ColumnDef, ColumnContext types
│   │   ├── row-action.ts           # RowAction, RowActionContext types
│   │   ├── validation.ts           # ValidationRule, ValidationError types
│   │   ├── component-props.ts      # All component prop types
│   │   └── events.ts               # All event payload types
│   │
│   ├── components/
│   │   ├── DataTable/
│   │   │   ├── DataTable.vue       # Main component
│   │   │   ├── DataTableCell.vue   # Cell renderer
│   │   │   ├── DataTableHeader.vue # Header renderer
│   │   │   ├── DataTableRow.vue    # Row renderer with actions
│   │   │   └── types.ts            # Local types
│   │   │
│   │   ├── AdvancedFilterBuilder/
│   │   │   ├── AdvancedFilterBuilder.vue
│   │   │   ├── FilterRow.vue
│   │   │   ├── FilterField.vue
│   │   │   ├── FilterOperator.vue
│   │   │   ├── types.ts
│   │   │   └── utils.ts            # Serialization logic
│   │   │
│   │   ├── MultiLanguageInputModal/
│   │   │   ├── MultiLanguageInputModal.vue
│   │   │   ├── LanguageTab.vue
│   │   │   ├── LanguageSearch.vue
│   │   │   ├── ValidationErrors.vue
│   │   │   ├── types.ts
│   │   │   └── validation.ts       # Per-language validation logic
│   │   │
│   │   ├── Layout/
│   │   │   ├── AppLayout.vue
│   │   │   ├── SidebarLayout.vue
│   │   │   ├── TopBar.vue
│   │   │   └── types.ts
│   │   │
│   │   ├── Filters/
│   │   │   ├── QuickFilterDropdown.vue
│   │   │   ├── ColumnVisibilityDropdown.vue
│   │   │   └── types.ts
│   │   │
│   │   ├── Forms/
│   │   │   ├── DrawerFormLayout.vue
│   │   │   ├── ModalFormLayout.vue
│   │   │   └── types.ts
│   │   │
│   │   ├── Dialogs/
│   │   │   ├── ConfirmDialog.vue
│   │   │   └── types.ts
│   │   │
│   │   ├── Status/
│   │   │   ├── StatusToggle.vue
│   │   │   ├── BadgeStatus.vue
│   │   │   ├── StatsCard.vue
│   │   │   ├── EmptyState.vue
│   │   │   ├── LoadingState.vue
│   │   │   ├── PaginationBar.vue
│   │   │   └── types.ts
│   │   │
│   │   └── index.ts                # Export all components
│   │
│   ├── composables/
│   │   ├── index.ts                # Export barrel
│   │   ├── useFilterBuilder.ts      # Manage filter state + serialization
│   │   ├── usePagination.ts         # Manage pagination state
│   │   ├── useColumnVisibility.ts   # Column visibility state persistence
│   │   ├── useMultiLanguageForm.ts  # Multi-language form state + validation
│   │   ├── useRowActions.ts         # Row action loading + execution
│   │   └── useDebounce.ts           # Utility composable
│   │
│   ├── utils/
│   │   ├── index.ts                # Export barrel
│   │   ├── filter-serializer.ts    # Filter encoding/decoding logic
│   │   ├── validation-helpers.ts   # Shared validation utilities
│   │   ├── format-helpers.ts       # Date, number, string formatting
│   │   ├── accessibility.ts        # ARIA utilities
│   │   └── storage.ts              # localStorage abstraction
│   │
│   ├── styles/
│   │   ├── index.css               # Main CSS file
│   │   ├── base.css                # Base styles
│   │   ├── tokens.css              # Design tokens (CSS custom properties)
│   │   ├── components.css          # Component-specific styles
│   │   ├── tailwind.config.ts      # Tailwind extension
│   │   └── theme/
│   │       ├── light.css           # Light theme tokens
│   │       └── dark.css            # Dark theme tokens (future)
│   │
│   └── constants.ts                # Component constants, sizes, limits
│
├── tests/
│   ├── unit/
│   │   ├── DataTable.spec.ts
│   │   ├── AdvancedFilterBuilder.spec.ts
│   │   ├── MultiLanguageInputModal.spec.ts
│   │   ├── useFilterBuilder.spec.ts
│   │   ├── useMultiLanguageForm.spec.ts
│   │   ├── filter-serializer.spec.ts
│   │   └── validation-helpers.spec.ts
│   │
│   ├── integration/
│   │   ├── DataTable-with-filters.spec.ts
│   │   ├── DataTable-row-actions.spec.ts
│   │   ├── AdvancedFilterBuilder-overflow.spec.ts
│   │   ├── MultiLanguageInputModal-validation.spec.ts
│   │   └── filter-serialization-flow.spec.ts
│   │
│   └── fixtures/
│       ├── mock-data.ts
│       ├── mock-columns.ts
│       └── mock-filters.ts
│
├── tsconfig.json                   # TypeScript config
├── vitest.config.ts                # Test runner config
├── package.json
└── README.md                       # Component API documentation
```

---

## SECTION 4: BUILD SYSTEM INTEGRATION

### 4.1 Monorepo Build Pipeline

**Build Target:** packages/ui-system is **library package**, not application.

**Output Structure:**

```
packages/ui-system/dist/
├── index.js                       # Main entry (CommonJS for now)
├── index.d.ts                     # TypeScript declarations
├── styles/
│   ├── index.css                  # Compiled CSS (Tailwind + Base)
│   └── tokens.css                 # Design tokens
└── components/                    # Optional: individual component exports
```

**Build Tool:** Vite (configured for library mode)

**Configuration Points:**

```
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@zidney/ui-system',
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    rollupOptions: {
      external: ['vue', 'tailwindcss'],  // Peer dependencies
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})
```

**Tree-Shaking:**

- Ensure all components are individually export-able: `export { DataTable } from './components'`
- Composables exported separately: `export { useFilterBuilder } from './composables'`
- Allows consuming apps to import only what they need
- Tailwind CSS is tree-shaken automatically (unused utilities removed)

**Dependency Management:**

```json
{
  "peerDependencies": {
    "vue": "^3.3.0",
    "tailwindcss": "^4.0.0"
  },
  "devDependencies": {
    "shadcn-vue": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "@vue/test-utils": "latest",
    "vite": "latest"
  }
}
```

**Shadcn-vue Integration:**

- ui-system **extends** shadcn-vue, does not duplicate
- Components that wrap shadcn-vue (e.g., DataTable uses Button, Input from shadcn)
- Source shadcn component definitions are **not copied** into ui-system
- Apps importing ui-system must also have shadcn-vue installed

### 4.2 Tailwind v4 Integration

**Configuration Location:** `packages/ui-system/styles/tailwind.config.ts`

**Content Scan Paths (Monorepo):**

```typescript
export default {
  content: [
    "./src/**/*.{vue,ts,tsx}",
    // When consuming app uses:
    "../../apps/*/src/**/*.{vue,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--color-brand-primary)",
          secondary: "var(--color-brand-secondary)",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
};
```

**CSS Custom Properties (Design Tokens):**

Located in `packages/ui-system/styles/tokens.css`:

```css
:root {
  /* Brand Colors */
  --color-brand-primary: #2563eb;
  --color-brand-secondary: #1e40af;

  /* Status Colors */
  --color-status-active: #22c55e;
  --color-status-inactive: #94a3b8;
  --color-status-pending: #f59e0b;
  --color-status-archived: #6b7280;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Typography */
  --font-family-sans: system-ui, -apple-system, sans-serif;
  --font-size-body: 14px;
  --font-size-heading: 16px;
}
```

**White-Label Customization Boundaries:**

- Apps can **override** CSS custom properties at runtime
- Apps **cannot** modify Tailwind utility classes
- Apps **cannot** add custom Tailwind extensions
- Customization is **scoped to design tokens only**

---

## SECTION 5: COMPONENT IMPLEMENTATION DETAILS

### 5.1 DataTable – Async Row Actions Management

**Internal State Machine (Composition):**

```typescript
// In DataTable.vue setup()

interface RowActionState {
  [actionId: string]: boolean; // true = loading
}

const rowActionLoading = reactive<Map<string, RowActionState>>(new Map());

const isActionLoading = (rowId: string, actionId: string): boolean => {
  return rowActionLoading.get(rowId)?.[actionId] ?? false;
};

const executeAction = async (row: TRow, action: RowAction<TRow>) => {
  const rowId = extractRowId(row); // App provides ID extraction logic

  // Initialize row action state if needed
  if (!rowActionLoading.has(rowId)) {
    rowActionLoading.set(rowId, {});
  }

  // Mark as loading
  rowActionLoading.get(rowId)![action.id] = true;
  emit("action-start", { actionId: action.id, row });

  try {
    // Execute callback (async)
    await action.callback(row);

    // Success: clear immediately
    rowActionLoading.get(rowId)![action.id] = false;
    emit("action-end", {
      actionId: action.id,
      row,
      success: true,
    });
  } catch (error) {
    // Error: show error state for 2 seconds then clear
    emit("action-end", {
      actionId: action.id,
      row,
      success: false,
      error: error as Error,
    });

    // Schedule error state clear (guarded against unmount)
    const timeoutId = setTimeout(() => {
      // Check component still mounted and row still exists
      if (!isUnmounting.value && rowActionLoading.has(rowId)) {
        rowActionLoading.get(rowId)![action.id] = false;
      }
    }, 2000);

    // Cleanup on unmount
    onBeforeUnmount(() => {
      clearTimeout(timeoutId);
      isUnmounting.value = true;
    });
  }
};

// Unmount guard flag
const isUnmounting = ref(false);
```

**Row Rendering with Actions:**

```vue
<template>
  <tr v-for="row in displayedRows" :key="getRowKey(row)">
    <td v-for="column in visibleColumns" :key="column.id">
      <DataTableCell :row="row" :column="column" />
    </td>
    <td class="actions">
      <div class="flex gap-2">
        <button
          v-for="action in rowActions"
          :key="action.id"
          :disabled="isActionLoading(getRowKey(row), action.id)"
          :class="{ 'is-loading': isActionLoading(getRowKey(row), action.id) }"
          @click="executeAction(row, action)"
        >
          <span v-if="isActionLoading(getRowKey(row), action.id)" class="spinner" />
          {{ action.label }}
        </button>
      </div>
    </td>
  </tr>
</template>
```

**Event Timing Guarantee:**

1. User clicks action button
2. **@action-start** emitted (parent app can show toast/log)
3. Button disabled, spinner appears
4. Callback awaited (no retry, no auto-refetch)
5. Callback resolves or rejects
6. **@action-end** emitted with success/error info
7. Parent app handles business logic (refetch, updates, etc.)
8. Button re-enabled after 2s (if error) or immediately (if success)

---

### 5.2 AdvancedFilterBuilder – URL Overflow Detection

**Serialization Logic:**

```typescript
// In AdvancedFilterBuilder composable

const serializeFilters = (filters: Filter[]): string => {
  // Compact representation
  const compact = filters.map((f) => ({
    f: f.fieldId, // fieldId → f
    op: f.operator, // operator → op
    v: f.value, // value → v
  }));

  const json = JSON.stringify({ filters: compact });
  const base64 = btoa(json);

  return `v1:${base64}`; // Version prefix
};

const deserializeFilters = (encoded: string): Filter[] => {
  if (!encoded.startsWith("v1:")) {
    throw new Error("Invalid filter encoding version");
  }

  const base64 = encoded.slice(3);
  const json = atob(base64);
  const data = JSON.parse(json);

  return data.filters.map((f: any) => ({
    fieldId: f.f,
    operator: f.op,
    value: f.v,
  }));
};

const checkUrlOverflow = (filters: Filter[]): boolean => {
  const encoded = serializeFilters(filters);

  // Add estimated query param overhead
  const fullUrl = `?filters=${encodeURIComponent(encoded)}`;

  return fullUrl.length > 2000; // Typical browser URL limit
};
```

**Overflow Detection Component Flow:**

```typescript
// In AdvancedFilterBuilder.vue

const isPersistedExternally = computed(() => {
  return filterMode.value === "localStorage";
});

watch(
  () => props.filters,
  (newFilters) => {
    const isOverflow = checkUrlOverflow(newFilters);

    if (isOverflow && filterMode.value === "url") {
      showOverflowWarning.value = true;
      emit("filter-overflow", { suggestedMode: "localStorage" });
    } else {
      showOverflowWarning.value = false;
    }
  },
);

const handleSwitchToStorageFallback = () => {
  filterMode.value = "localStorage";
  emit("storage-fallback-triggered", { reason: "url-overflow" });
};
```

**Component Template:**

```vue
<template>
  <div class="advanced-filter-builder">
    <div v-if="showOverflowWarning" class="warning-banner">
      <p>
        Filters are too complex for URL sharing. Consider reducing filter count or using session
        storage.
      </p>
      <button @click="handleSwitchToStorageFallback">Use Session Storage</button>
    </div>

    <!-- Filter rows -->
    <div class="filter-rows">
      <!-- FilterRow components -->
    </div>

    <!-- Serialization output (read-only for debugging) -->
    <div class="serialization-info" v-if="showDebugInfo">
      <small>Mode: {{ filterMode }} | Size: {{ serializeFilters(filters).length }} chars</small>
      <small v-if="isPersistedExternally">Persisted externally</small>
    </div>
  </div>
</template>
```

---

### 5.3 MultiLanguageInputModal – Per-Language Validation

**Validation Architecture:**

```typescript
// In useMultiLanguageForm composable

interface LanguageValidationState {
  errors: string[];
  isDirty: boolean;
}

const languageStates = reactive<Map<string, LanguageValidationState>>(new Map());

const validateLanguage = (code: string, value: string): ValidateResult => {
  const rules = props.validationRules?.[code] ?? [];
  const errors: string[] = [];

  for (const rule of rules) {
    const error = rule.validate(value);
    if (error) errors.push(error);
  }

  languageStates.set(code, {
    errors,
    isDirty: true,
  });

  return { isValid: errors.length === 0, errors };
};

const validateGlobal = (): ValidateResult => {
  const errors: string[] = [];
  const values = Object.fromEntries(formValues.value);

  // Check default language
  const defaultLang = props.languages.find((l) => l.isDefault);
  if (defaultLang && !values[defaultLang.code]?.trim()) {
    errors.push(`Default language "${defaultLang.name}" is required`);
  }

  // Check required languages
  if (props.requiredLanguages.length === 0) {
    emit("language-config-error", {
      reason: "no_required_languages",
      fallback: defaultLang?.code ?? props.languages[0].code,
    });
    props.requiredLanguages = [defaultLang?.code ?? props.languages[0].code];
  }

  for (const langCode of props.requiredLanguages) {
    if (!values[langCode]?.trim()) {
      const lang = props.languages.find((l) => l.code === langCode);
      errors.push(`Required language "${lang?.name}" must have content`);
    }
  }

  return { isValid: errors.length === 0, errors };
};

const isValid = computed(() => {
  const globalResult = validateGlobal();
  return globalResult.isValid;
});
```

**Modal Component Contract:**

```vue
<template>
  <DialogPrimitive>
    <div class="multi-language-modal">
      <!-- Language tabs -->
      <div class="language-tabs">
        <button
          v-for="lang in filteredLanguages"
          :key="lang.code"
          :class="{ active: activeLanguage === lang.code }"
          @click="activeLanguage = lang.code"
        >
          {{ lang.name }}
          <span v-if="!formValues[lang.code]?.trim()" class="unfilled-indicator" />
        </button>
      </div>

      <!-- Language search (optional) -->
      <input
        v-if="allowLanguageSearch"
        v-model="languageSearchQuery"
        type="text"
        placeholder="Search languages..."
      />

      <!-- Tab content -->
      <div class="language-content">
        <textarea
          v-model="formValues[activeLanguage]"
          :aria-invalid="hasError(activeLanguage)"
          @blur="validateLanguage(activeLanguage, formValues[activeLanguage])"
        />

        <!-- Validation errors for active language -->
        <ValidationErrors
          v-if="languageStates.get(activeLanguage)?.errors"
          :errors="languageStates.get(activeLanguage)!.errors"
        />
      </div>

      <!-- Global validation errors -->
      <div v-if="globalErrors.length" class="global-errors">
        <p v-for="error in globalErrors" :key="error">{{ error }}</p>
      </div>

      <!-- Coverage indicator -->
      <div class="coverage-bar">
        {{ filledLanguages.size }} / {{ languages.length }} languages filled
      </div>

      <!-- Actions -->
      <div class="modal-actions">
        <button @click="$emit('cancel')">Cancel</button>
        <button :disabled="!isValid" @click="handleSave">Save</button>
      </div>
    </div>
  </DialogPrimitive>
</template>
```

---

## SECTION 6: STYLING AND TOKEN INTEGRATION

### 6.1 Design Token Architecture

**Token Definition Hierarchy:**

```
Design Tokens (CSS Custom Properties)
  ├── Color Tokens
  │   ├── Brand Tokens (primary, secondary, accent)
  │   ├── Status Tokens (active, inactive, pending, archived, warning, error)
  │   ├── Neutral Tokens (gray scale for text, borders, backgrounds)
  │   └── Semantic Tokens (success, warning, error, info)
  │
  ├── Typography Tokens
  │   ├── Font families
  │   ├── Font sizes (heading, body, caption, code)
  │   └── Line heights
  │
  ├── Spacing Tokens
  │   ├── xs, sm, md, lg, xl, 2xl (0.25rem → 2rem)
  │   └── Padding, margin scales
  │
  ├── Shadow Tokens
  │   ├── Small (cards), medium (modals), large (menus)
  │   └── Elevation scale
  │
  └── Radius Tokens
      ├── Small (buttons), medium (cards), large (modals)
      └── Full (circles)
```

**Token Definition File:**

```css
/* packages/ui-system/styles/tokens.css */

:root {
  /* Color palette */
  --color-white: #ffffff;
  --color-gray-0: #f8fafc;
  --color-gray-50: #f1f5f9;
  --color-gray-100: #e2e8f0;
  --color-gray-200: #cbd5e1;
  --color-gray-500: #64748b;
  --color-gray-900: #0f172a;

  /* Brand colors */
  --color-brand-primary: #2563eb;
  --color-brand-secondary: #1e40af;
  --color-brand-accent: #0284c7;

  /* Status colors */
  --color-status-active: #22c55e;
  --color-status-inactive: #94a3b8;
  --color-status-pending: #f59e0b;
  --color-status-archived: #6b7280;
  --color-status-warning: #f59e0b;
  --color-status-error: #ef4444;

  /* Typography */
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-loose: 1.75;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
}
```

### 6.2 Tailwind Configuration Integration

**Extension Pattern:**

```typescript
// tailwind.config.ts in ui-system

export default {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--color-brand-primary)",
          secondary: "var(--color-brand-secondary)",
          accent: "var(--color-brand-accent)",
        },
        status: {
          active: "var(--color-status-active)",
          inactive: "var(--color-status-inactive)",
          pending: "var(--color-status-pending)",
          archived: "var(--color-status-archived)",
        },
      },
      spacing: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
      },
      fontSize: {
        xs: "var(--font-size-xs)",
        sm: "var(--font-size-sm)",
        base: "var(--font-size-base)",
        lg: "var(--font-size-lg)",
        xl: "var(--font-size-xl)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
    },
  },
};
```

### 6.3 White-Label Customization Boundaries

**Allowed Customizations (App Layer):**

- Override CSS custom properties:
  `document.documentElement.style.setProperty('--color-brand-primary', '#...')`
- Inject custom favicon, logo, colors on app startup
- Load custom fonts via @font-face before components mount

**Not Allowed:**

- Modify Tailwind config structure (no new utilities)
- Inject new design tokens
- Override component CSS classes
- Use `!important` to override styles
- Hardcode brand-specific logic in components

**Implementation Pattern for Apps:**

```typescript
// In app layer setup
const applyWorkspaceTheme = (workspace: Workspace) => {
  const root = document.documentElement;

  if (workspace.branding?.primaryColor) {
    root.style.setProperty("--color-brand-primary", workspace.branding.primaryColor);
  }

  if (workspace.branding?.logoUrl) {
    // Update app logo separately
    document.querySelector('img[alt="logo"]')?.setAttribute("src", workspace.branding.logoUrl);
  }
};
```

### 6.4 CSS Scoping & Style Isolation (MANDATORY)

**Requirement:** All components MUST use Vue's `<style scoped>` or CSS Modules to prevent style
leakage.

**Implementation Pattern (Required for all components):**

```vue
<!-- ✅ CORRECT: Using scoped styles -->
<template>
  <div class="data-table">
    <table class="table">
      <!-- content -->
    </table>
  </div>
</template>

<script setup lang="ts">
// Component logic
</script>

<style scoped>
/* All styles automatically scoped with data-v-xxx attribute */
.data-table {
  display: flex;
}

.table {
  width: 100%;
}
</style>
```

**CSS Modules Alternative (also acceptable):**

```vue
<template>
  <div :class="styles.dataTable">
    <table :class="styles.table">
      <!-- content -->
    </table>
  </div>
</template>

<script setup lang="ts">
import styles from "./DataTable.module.css";
</script>
```

**Prohibition:**

- ❌ NO global styles without namespace (e.g., no `.button { ... }` in global scope)
- ❌ NO unscoped `<style>` blocks (must use `<style scoped>`)
- ❌ NO inline `style` attributes with critical rules (must be in scoped styles)
- ❌ NO CSS that relies on parent component class selectors

**Verification (Part of Task 8A Build Config & Task 1 Type Definitions):**

- Build step must fail if any component has unscoped `<style>` block
- Linting rule (ESLint) must enforce `<style scoped>` or CSS Modules
- CSS output must contain data-v-xxx selectors proving scoping applied

---

## SECTION 7: TYPE SYSTEM ARCHITECTURE

### 7.1 Generic DataTable Typing

```typescript
// types/column.ts

export interface ColumnDef<TRow> {
  id: string;
  header: string | ((context: HeaderContext<TRow>) => VNode);
  accessor?: string | ((row: TRow) => any); // Optional for primitives
  cell?: (context: CellContext<TRow>) => VNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableHiding?: boolean;
  size?: number;
  meta?: Record<string, any>;
}

export interface HeaderContext<TRow> {
  column: ColumnDef<TRow>;
  table: DataTableInstance<TRow>;
}

export interface CellContext<TRow> {
  row: TRow;
  column: ColumnDef<TRow>;
  value: any;
  table: DataTableInstance<TRow>;
}

// Discriminated union for type safety
export type PrimitiveColumnDef<TRow> = ColumnDef<TRow> & {
  // accessor is optional; inferred from id
};

export type ComputedColumnDef<TRow> = ColumnDef<TRow> & {
  accessor: (row: TRow) => any; // REQUIRED
};

// Strict typing example
const columns: (PrimitiveColumnDef<User> | ComputedColumnDef<User>)[] = [
  {
    id: "email",
    header: "Email",
    // accessor inferred from id
  },
  {
    id: "fullName",
    header: "Name",
    accessor: (user) => `${user.firstName} ${user.lastName}`, // Required
  },
];
```

### 7.2 Filter Type Hierarchy

```typescript
// types/common.ts

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "between";

export type FilterFieldType = "text" | "select" | "date" | "boolean" | "number";

export interface FilterField {
  id: string;
  label: string;
  type: FilterFieldType;
  operators: FilterOperator[];
  options?: { value: any; label: string }[]; // For select type
  placeholder?: string;
}

export interface Filter {
  fieldId: string;
  operator: FilterOperator;
  value: any | [any, any]; // [min, max] for 'between'
}

export interface FilterGroup {
  logic: "and" | "or";
  filters: Filter[];
  groups?: FilterGroup[];
}
```

### 7.3 Row Action Types

```typescript
// types/row-action.ts

export interface RowAction<TRow> {
  id: string;
  label: string;
  icon?: string;
  callback: (row: TRow) => Promise<void>;
  disabled?: boolean | ((row: TRow) => boolean);
  variant?: "primary" | "secondary" | "destructive";
  confirmation?: {
    title: string;
    message: string;
    confirmLabel?: string;
    isDangerous?: boolean;
  };
}

export interface RowActionEvent<TRow> {
  actionId: string;
  row: TRow;
  success?: boolean;
  error?: Error;
  timestamp: number;
}
```

### 7.4 Component Prop Types

```typescript
// types/component-props.ts

export type DataTableProps<TRow> = {
  rows: TRow[];
  columns: (PrimitiveColumnDef<TRow> | ComputedColumnDef<TRow>)[];
  totalCount: number;
  paginationMode: "server" | "client";
  paginationState: PaginationState;
  loading: boolean;
  selectedRows?: string[];
  rowActions?: RowAction<TRow>[];
  sortState?: SortState;
  filterState?: Filter[];
  enableColumnVisibility?: boolean;
  enableRowSelection?: boolean;
  enableColumnSorting?: boolean;
  enableQuickFilter?: boolean;
  allowExport?: boolean;
};

export type MultiLanguageInputModalProps = {
  isOpen: boolean;
  title: string;
  languages: Language[];
  requiredLanguages: string[]; // Min 1 required
  initialValues?: Record<string, string>;
  validationRules?: Record<string, ValidationRule[]>;
  filterMode?: "all" | "filled" | "unfilled";
  allowLanguageSearch?: boolean;
};
```

---

## SECTION 8: TESTING STRATEGY (IMPLEMENTATION-LEVEL)

### 8.1 Unit Test Structure

**DataTable Component Tests:**

```typescript
// tests/unit/DataTable.spec.ts

describe("DataTable", () => {
  describe("Rendering", () => {
    test("renders all rows");
    test("renders visible columns only");
    test("respects column visibility state");
    test("shows loading skeleton when loading=true");
  });

  describe("Pagination", () => {
    test("server mode: emits @pagination-changed on page change");
    test("server mode: does NOT slice rows locally");
    test("client mode: slices rows based on paginationState");
    test("client mode: computes totalPages from array length");
  });

  describe("Row Actions (LOCKED DECISION 2)", () => {
    test("renders action buttons for each row");
    test("emits @action-start when action clicked");
    test("disables button during async callback");
    test("shows spinner during async callback");
    test("emits @action-end with success=true on resolve");
    test("emits @action-end with success=false on reject");
    test("shows error state for 2 seconds on failure");
    test("does NOT auto-retry failed actions");
    test("does NOT auto-refetch data after action");
  });

  describe("Row Selection", () => {
    test("emits @row-selected when checkbox clicked");
    test("respects selectedRows prop");
  });

  describe("Sorting", () => {
    test("emits @sort-changed on column header click");
  });

  describe("Quick Filter", () => {
    test("emits @quick-filter-changed on input");
    test("debounces input (300ms default)");
  });

  describe("Column Visibility", () => {
    test("emits @column-visibility-changed on visibility toggle");
  });
});
```

**AdvancedFilterBuilder Tests:**

```typescript
// tests/unit/AdvancedFilterBuilder.spec.ts

describe("AdvancedFilterBuilder", () => {
  describe("Filter Serialization (LOCKED DECISION 3)", () => {
    test("serializeFilters() returns base64-encoded JSON with v1: prefix");
    test("deserializeFilters() decodes and validates");
    test("serializeFilters() uses compact key names (f, op, v)");
  });

  describe("URL Overflow Detection (LOCKED DECISION 3)", () => {
    test("detects when encoded filter > 2000 chars");
    test("emits @filter-overflow when overflow detected");
    test('disables "Add Filter" button when overflow active');
    test("shows warning banner when overflow active");
    test("exposes isOverflowed computed property");
  });

  describe("Storage Fallback", () => {
    test("exposes isPersistedExternally computed property");
    test("emits @storage-fallback-triggered on mode switch");
    test("persists to localStorage when fallback active");
  });

  describe("Filter Validation", () => {
    test("validates filter value types");
    test("rejects invalid operators for field type");
  });
});
```

**MultiLanguageInputModal Tests:**

```typescript
// tests/unit/MultiLanguageInputModal.spec.ts

describe("MultiLanguageInputModal", () => {
  describe("Language Validation (LOCKED DECISION 5)", () => {
    test("enforces default language not empty");
    test("enforces all requiredLanguages have content");
    test("rejects submission if any requiredLanguage empty");
    test("computes isValid = false when validation fails");
  });

  describe("Per-Language Validation (LOCKED DECISION 5)", () => {
    test("runs language-specific validation rules");
    test("accumulates errors per language");
    test("emits @validation-changed on language input");
  });

  describe("Required Languages Constraint", () => {
    test("defaults to 1 required language if array empty");
    test("logs warning if requiredLanguages = []");
    test("requires minimum 1 language with content");
    test("rejects if no required languages specified");
  });

  describe("Filter Modes", () => {
    test("all mode: shows all language tabs");
    test("filled mode: shows only languages with content");
    test("unfilled mode: shows only languages without content");
  });

  describe("Language Search", () => {
    test("filters language tabs by search query");
    test("case-insensitive search");
  });

  describe("Coverage Indicator", () => {
    test("displays filled vs total languages");
    test("updates coverage on input");
  });

  describe("Events", () => {
    test("emits @save with language values");
    test("emits @cancel on cancel");
    test("emits @validation-changed on any input change");
  });
});
```

### 8.2 Integration Test Scenarios

**DataTable + Async Row Actions:**

```typescript
// tests/integration/DataTable-row-actions.spec.ts

describe("DataTable with Async Row Actions", () => {
  test("Full flow: click action → @action-start → loading → @action-end → restore", async () => {
    // 1. Mount DataTable with sample rows and action
    // 2. Click action button
    // 3. Assert @action-start emitted
    // 4. Assert button disabled + spinner visible
    // 5. Wait for action callback promise
    // 6. Assert @action-end emitted with success=true
    // 7. Assert button re-enabled
  });

  test("Error handling: action rejects → error state → 2s timeout → restore", async () => {
    // 1. Mount DataTable with failing action
    // 2. Click action button
    // 3. Wait for callback rejection
    // 4. Assert @action-end emitted with success=false
    // 5. Assert error indicator visible
    // 6. Wait 2 seconds
    // 7. Assert button restored to normal state
  });

  test("Multiple actions per row: execute independently", async () => {
    // 1. Mount DataTable with 2 row actions
    // 2. Click first action
    // 3. While loading, click second action on same row
    // 4. Assert both actions execute (separate state)
    // 5. Assert both @action-end events emitted
  });
});
```

**AdvancedFilterBuilder + URL Overflow:**

```typescript
// tests/integration/AdvancedFilterBuilder-overflow.spec.ts

describe("AdvancedFilterBuilder with URL Overflow", () => {
  test("Overflow detection → fallback → URL sync", async () => {
    // 1. Add filters until > 2000 chars
    // 2. Assert @filter-overflow emitted
    // 3. Assert warning banner visible
    // 4. User clicks "Use Session Storage"
    // 5. Assert @storage-fallback-triggered emitted
    // 6. Assert isPersistedExternally = true
    // 7. Assert can add more filters (no overflow limit in localStorage)
  });
});
```

**MultiLanguageInputModal + Validation:**

```typescript
// tests/integration/MultiLanguageInputModal-validation.spec.ts

describe("MultiLanguageInputModal with Validation", () => {
  test("Minimum 1 required language → enforce content", async () => {
    // 1. Mount with requiredLanguages = ['en']
    // 2. Leave 'en' tab empty
    // 3. Try to submit
    // 4. Assert @validation-changed emitted with isValid=false
    // 5. Assert error message shown
    // 6. Fill 'en' tab
    // 7. Assert @validation-changed emitted with isValid=true
    // 8. Assert submit enabled
  });

  test("Per-language rules + global constraint", async () => {
    // 1. Mount with per-language validation (max length = 10)
    // 2. Enter text > 10 chars in language tab
    // 3. Assert language-specific error shown
    // 4. Fix length; enter required language content
    // 5. Assert global validation passes
  });
});
```

### 8.3 Coverage Targets

| Area                    | Target | Focus                                                  |
| ----------------------- | ------ | ------------------------------------------------------ |
| DataTable               | 85%+   | Row actions, pagination modes, loading states          |
| AdvancedFilterBuilder   | 80%+   | Serialization, overflow detection, storage fallback    |
| MultiLanguageInputModal | 85%+   | Per-language validation, required language enforcement |
| useFilterBuilder        | 90%+   | State management, serialization, URL sync              |
| useMultiLanguageForm    | 90%+   | Validation logic, per-language rules                   |
| Composables (general)   | 85%+   | All composables tested in isolation                    |

---

## SECTION 9: MIGRATION STRATEGY FOR EXISTING MMC COMPONENTS

### 9.1 Current MMC Table State

**Assumption:** MMC currently has custom table implementations (DataTableItemGrid, CustomTableRow,
etc.) scattered across different pages.

**Migration Phases:**

### Phase 1: Foundation (Week 1-2)

**Goal:** Establish ui-system as canonical component library

**Steps:**

1. Finalize DataTable component (core implementation)
2. Deploy shared ui-system to monorepo
3. Document DataTable API + prop contracts
4. Set up storybook entries (if storybook phase proceeds)

**Affected MMC Pages:** None yet (foundation only)

**Backwards Compatibility:** N/A

### Phase 2: Dashboard Tables (Week 3-4)

**Goal:** Migrate read-only dashboard tables first (lowest risk)

**Target Pages:**

- Institutions dashboard (list view)
- Agents list dashboard
- Students dashboard list

**Migration Pattern:**

```typescript
// BEFORE: Custom table implementation
<CustomInstitutionTable
  :data="institutions"
  :loading="loading"
/>

// AFTER: Shared UI system
<DataTable<Institution>
  :rows="institutions"
  :columns="institutionColumns"
  :paginationState="{ currentPage, pageSize, totalCount }"
  :loading="loading"
  pagination-mode="server"
  @pagination-changed="handlePageChange"
/>
```

**Backwards Compatibility:**

- **Keep** old components available for 2 weeks (deprecation period)
- **Document** migration pattern
- **Provide** column definition templates

### Phase 3: Form Tables (Week 5-7)

**Goal:** Migrate tables with row actions (edit, delete, archive)

**Target Pages:**

- Roles management
- Permissions matrix
- Agent assignments

**Migration Considerations:**

- Row actions must handle async callbacks (LOCKED DECISION 2)
- Each row action emits `@action-start` and `@action-end`
- Parent app is responsible for refetch after success

**Example:**

```typescript
const rowActions: RowAction<Role>[] = [
  {
    id: "edit",
    label: "Edit",
    callback: async (role) => {
      // Show modal, wait for save
      // Component does NOT refetch
      showRoleEditModal(role);
    },
  },
  {
    id: "delete",
    label: "Delete",
    variant: "destructive",
    callback: async (role) => {
      await api.roles.delete(role.id);
      // Parent app will handle @action-end and refetch
    },
  },
];
```

**Backwards Compatibility:**

- Old table components deprecated
- Grace period: allow both old + new for 3 weeks

### Phase 4: Filter Integration (Week 8-10)

**Goal:** Migrate pages using AdvancedFilterBuilder

**Target Pages:**

- Reports dashboard (complex filters)
- Audit logs page
- Custom pages with dynamic filters

**Filter Serialization:**

- URL primary (LOCKED DECISION 3)
- Detect overflow at runtime
- Fallback to localStorage
- Expose `isPersistedExternally` flag to user

**Example:**

```typescript
const handleFilterChange = (filters: Filter[]) => {
  try {
    const serialized = serializeFilters(filters);
    router.push({ query: { filters: serialized } });
  } catch (error) {
    if (error.reason === "overflow") {
      // Switch to localStorage
      localStorage.setItem(`${workspace}:filter-state`, serialized);
      showNotification("Filters saved locally due to complexity");
    }
  }
};
```

### Phase 5: Multi-Language Forms (Week 11-12)

**Goal:** Migrate entity detail pages requiring translations

**Target Pages:**

- Institution editor (translations)
- Agent profile editor (translations)
- Report template editor (translations)

**Modal Integration:**

```typescript
<MultiLanguageInputModal
  :is-open="editingTranslations"
  title="Edit Translations"
  :languages="availableLanguages"
  :required-languages="['en']"  // Enforced minimum 1
  :initial-values="currentTranslations"
  :validation-rules="translationRules"
  @save="handleSaveTranslations"
  @cancel="editingTranslations = false"
/>
```

### 9.2 Phased Adoption Approach

**Week 1-2: Foundation**

- Deploy ui-system package
- Update package.json dependencies

**Week 3-4: Read-Only Tables**

- Migrate 3 dashboard pages
- Collect feedback
- Document lessons learned

**Week 5-7: Interactive Tables**

- Migrate 5 pages with row actions
- Test async callback patterns
- Refine error handling

**Week 8-10: Advanced Filters**

- Migrate 3 pages with filters
- Test URL overflow detection
- Monitor localStorage usage

**Week 11-12: Multi-Language**

- Migrate 4 entity editors
- Test validation flows
- Ensure workspace-specific language rules

**Week 13+: Cleanup**

- Deprecate old table components
- Remove dual imports
- Close stage

### 9.3 Communication & Documentation

**For MMC Developers:**

1. **Migration Guide Document:**
   - Step-by-step: old component → ui-system component
   - Common patterns (pagination, row actions, filters)
   - Troubleshooting section

2. **Weekly Sync:**
   - Report migration progress
   - Collect blocker feedback
   - Adjust timelines if needed

3. **Code Review Template:**
   - Checklist for DataTable usage
   - Common mistakes to avoid
   - Performance considerations

**For App Users:**

- Zero visible change (UI stable)
- Performance improvements (shared codebase, less duplication)
- Future: dark mode, improved accessibility

---

## SECTION 10: COMPOSABLE UTILITIES

### 10.1 useFilterBuilder

**Purpose:** Manage filter state, serialization, URL sync

```typescript
// composables/useFilterBuilder.ts

export function useFilterBuilder(options: {
  initialFilters?: Filter[];
  serializationMode?: "url" | "localStorage";
  availableFields: FilterField[];
}) {
  // State
  const filters = ref<Filter[]>(options.initialFilters ?? []);
  const serializationMode = ref<"url" | "localStorage">(options.serializationMode ?? "url");

  // Computed
  const serialized = computed(() => {
    return serializeFilters(filters.value);
  });

  const isPersistedExternally = computed(() => {
    return serializationMode.value === "localStorage";
  });

  const isOverflowed = computed(() => {
    return checkUrlOverflow(filters.value);
  });

  // Methods
  const addFilter = (filter: Filter) => {
    filters.value.push(filter);
  };

  const removeFilter = (index: number) => {
    filters.value.splice(index, 1);
  };

  const updateFilter = (index: number, filter: Filter) => {
    filters.value.splice(index, 1, filter);
  };

  const syncToUrl = (router: Router) => {
    router.push({ query: { filters: serialized.value } });
  };

  const syncToStorage = (key: string) => {
    localStorage.setItem(key, serialized.value);
  };

  const resetFilters = () => {
    filters.value = [];
  };

  return {
    filters: readonly(filters),
    serialized,
    isPersistedExternally,
    isOverflowed,
    addFilter,
    removeFilter,
    updateFilter,
    syncToUrl,
    syncToStorage,
    resetFilters,
  };
}
```

### 10.2 usePagination

**Purpose:** Manage pagination state (agnostic to server/client)

```typescript
// composables/usePagination.ts

export function usePagination(options: {
  totalCount: number;
  pageSize?: number;
  initialPage?: number;
}) {
  const currentPage = ref(options.initialPage ?? 1);
  const pageSize = ref(options.pageSize ?? 25);

  const totalPages = computed(() => {
    return Math.ceil(options.totalCount / pageSize.value);
  });

  const isFirstPage = computed(() => currentPage.value === 1);
  const isLastPage = computed(() => currentPage.value >= totalPages.value);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages.value));
    currentPage.value = clamped;
  };

  const nextPage = () => goToPage(currentPage.value + 1);
  const previousPage = () => goToPage(currentPage.value - 1);

  const setPageSize = (size: number) => {
    pageSize.value = size;
    currentPage.value = 1; // Reset to first page
  };

  return {
    currentPage: readonly(currentPage),
    pageSize: readonly(pageSize),
    totalPages,
    isFirstPage,
    isLastPage,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
  };
}
```

### 10.3 useColumnVisibility

**Purpose:** Manage column visibility with persistence

```typescript
// composables/useColumnVisibility.ts

export function useColumnVisibility(options: { availableColumns: string[]; persistKey?: string }) {
  const visibleColumns = ref<Set<string>>(new Set(options.availableColumns));

  const onMounted = () => {
    if (options.persistKey) {
      const stored = localStorage.getItem(options.persistKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          visibleColumns.value = new Set(parsed);
        } catch {
          // Invalid stored value; ignore
        }
      }
    }
  };

  const toggleColumn = (columnId: string) => {
    if (visibleColumns.value.has(columnId)) {
      visibleColumns.value.delete(columnId);
    } else {
      visibleColumns.value.add(columnId);
    }

    if (options.persistKey) {
      localStorage.setItem(options.persistKey, JSON.stringify([...visibleColumns.value]));
    }
  };

  const showAll = () => {
    visibleColumns.value = new Set(options.availableColumns);
  };

  const hideAll = () => {
    visibleColumns.value.clear();
  };

  const isVisible = (columnId: string): boolean => {
    return visibleColumns.value.has(columnId);
  };

  onMounted();

  return {
    visibleColumns: computed(() => [...visibleColumns.value]),
    toggleColumn,
    showAll,
    hideAll,
    isVisible,
  };
}
```

### 10.4 useMultiLanguageForm

**Purpose:** Manage multi-language form state + validation

```typescript
// composables/useMultiLanguageForm.ts

export function useMultiLanguageForm(options: {
  languages: Language[];
  requiredLanguages?: string[];
  validationRules?: Record<string, ValidationRule[]>;
  initialValues?: Record<string, string>;
}) {
  // Ensure minimum 1 required language
  const requiredLanguages = ref(
    (options.requiredLanguages?.length ?? 0 > 0)
      ? options.requiredLanguages
      : [options.languages[0].code],
  );

  const formValues = ref<Record<string, string>>(options.initialValues ?? {});

  const languageErrors = ref<Record<string, string[]>>({});

  const validateLanguage = (code: string): string[] => {
    const rules = options.validationRules?.[code] ?? [];
    const value = formValues.value[code] ?? "";
    const errors: string[] = [];

    for (const rule of rules) {
      const error = rule.validate(value);
      if (error) errors.push(error);
    }

    languageErrors.value[code] = errors;
    return errors;
  };

  const validateGlobal = (): string[] => {
    const errors: string[] = [];

    // Check default language
    const defaultLang = options.languages.find((l) => l.isDefault);
    if (defaultLang && !(formValues.value[defaultLang.code] ?? "").trim()) {
      errors.push(`Default language is required`);
    }

    // Check required languages
    for (const code of requiredLanguages.value) {
      if (!(formValues.value[code] ?? "").trim()) {
        const lang = options.languages.find((l) => l.code === code);
        errors.push(`Language "${lang?.name}" is required`);
      }
    }

    return errors;
  };

  const isValid = computed(() => {
    return validateGlobal().length === 0;
  });

  return {
    formValues,
    languageErrors: readonly(languageErrors),
    requiredLanguages: readonly(requiredLanguages),
    validateLanguage,
    validateGlobal,
    isValid,
  };
}
```

---

## SECTION 11: ERROR HANDLING & EDGE CASES

### 11.1 DataTable Row Action Interruption

**Scenario:** User navigates away during async row action

**Handling:**

- Component cleanup on unmount cancels pending action? **NO** (app responsibility)
- Event emitted anyway if callback resolves/rejects after navigation? **YES** (app must handle no-op
  via `try-catch` or flag)
- Parent app should track `isActionInProgress` separately to prevent double-submission

**Pattern for Apps:**

```typescript
const isSubmitting = ref(false);

const handleRowAction = async (row: User, action: RowAction<User>) => {
  if (isSubmitting.value) return; // Prevent duplicate

  isSubmitting.value = true;

  try {
    await action.callback(row);
  } catch (error) {
    emit("action-error", {
      actionId: action.id,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isSubmitting.value = false;
  }
};
```

### 11.2 Filter Serialization Failure

**Scenario:** Filter value contains un-serializable data (circular reference, Symbol, etc.)

**Handling:**

- Component attempts serialization
- If `JSON.stringify()` fails, emit `@serialization-error { reason: string }`
- Do NOT silently fall back to empty filters
- Show error banner to user

**Component Code:**

```typescript
const serializeFilters = (filters: Filter[]): string => {
  try {
    const compact = filters.map((f) => ({
      f: f.fieldId,
      op: f.operator,
      v: f.value,
    }));

    const json = JSON.stringify({ filters: compact });
    return `v1:${btoa(json)}`;
  } catch (error) {
    emit("serialization-error", {
      reason: `Cannot serialize filters: ${error.message}`,
    });
    throw error;
  }
};
```

### 11.3 localStorage Unavailable

**Scenario:** User has disabled localStorage or quota exceeded

**Handling:**

- Attempt localStorage write in `try-catch`
- If fails, emit `@storage-error { reason: 'quota-exceeded' | 'not-available' }`
- Show user warning: "Cannot save filters locally. Try emptying filters."
- Keep app functional (filters still work via URL)

**Implementation:**

```typescript
const syncToStorage = (key: string, data: string) => {
  try {
    localStorage.setItem(key, data);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      emit("storage-error", { reason: "quota-exceeded" });
    } else {
      emit("storage-error", { reason: "not-available" });
    }
  }
};
```

### 11.4 Invalid Filter Deserialization

**Scenario:** User bookmarks malformed filter URL

**Handling:**

- Deserialize in `try-catch`
- If fails, emit `@deserialization-error { reason: string }`
- Reset filters to empty array
- Show user warning: "Filters are invalid. Resetting."

**Implementation:**

```typescript
const deserializeFilters = (encoded: string): Filter[] => {
  try {
    if (!encoded.startsWith("v1:")) {
      throw new Error("Unknown version");
    }

    const base64 = encoded.slice(3);
    const json = atob(base64);
    const data = JSON.parse(json);

    // Validate structure
    if (!Array.isArray(data.filters)) {
      throw new Error("Invalid structure");
    }

    return data.filters;
  } catch (error) {
    emit("deserialization-error", { reason: error.message });
    return [];
  }
};
```

### 11.5 MultiLanguageInputModal – Missing Languages

**Scenario:** Component initialized with `languages = []`

**Handling:**

- Compute `isValid = false`
- Log warning to console
- Show error message: "No languages available"
- Disable submit button

**Implementation:**

```typescript
const isValid = computed(() => {
  if (props.languages.length === 0) {
    emit("language-invalid", { reason: "no_languages_provided" });
    return false;
  }

  // ... validation logic
});
```

### 11.6 Invalid prop Types

**Scenario:** App passes invalid types to component props

**Handling:**

- TypeScript strict mode catch at development
- Runtime validation with helpful error messages
- Component renders error state in production

**Pattern:**

```typescript
const props = withDefaults(
  defineProps<{
    rows: TRow[];
    columns: ColumnDef<TRow>[];
    paginationMode: "server" | "client";
  }>(),
  {},
);

onMounted(() => {
  if (!Array.isArray(props.rows)) {
    emit("validation-error", {
      field: "rows",
      error: "invalid_type",
      message: "rows must be array",
    });
  }

  if (!Array.isArray(props.columns) || props.columns.length === 0) {
    emit("validation-error", {
      field: "columns",
      error: "invalid_type",
      message: "columns must be non-empty array",
    });
  }
});
```

---

## SECTION 12: PERFORMANCE OPTIMIZATION

### 12.0 Service Level Objectives (SLOs) – MANDATORY

**Component Rendering Performance:**

- **Single component mount:** < 16ms (60fps @ 16ms/frame)
- **Component re-render (props change):** < 8ms
- **DataTable render (N rows, M cols):** < 16ms for N ≤ 50 rows
- **Form validation feedback:** < 50ms total (input lag imperceptible)

**Event Emission Performance:**

- **@action-start emission latency:** < 1ms (button state update)
- **@filter-changed emission latency:** < 1ms (parent state update)
- **@pagination-changed emission latency:** < 1ms
- **@save event (form completion):** < 1ms after validation passes

**Concurrent Operation Performance (High-Concurrency Exams):**

- **50 concurrent row actions:** All complete within 2000ms total
- **DataTable re-render during action wave:** No frame drops (maintain 60fps)
- **Filter serialization:** < 5ms for 50+ filters

**Verification (Part of Task 9A & 10A):**

- All unit tests must include performance assertions using `performance.now()`
- Integration tests must measure end-to-end event flow latency
- Build output must include timing report

**Non-Compliance Consequence:**

Any component exceeding these SLOs must be optimized or rejected from production. This is NOT a
guideline; it is enforcement criteria.

---

### 12.1 Large Dataset Handling

**Constraint:** Pagination is **mandatory** for DataTable (enforced at prop level)

**Why:** Rendering 1000+ rows causes layout thrashing and memory pressure

**Implementation:**

```typescript
// Props enforce pagination or lazy loading
interface DataTableProps {
  paginationMode: "server" | "client"; // Not 'none'
  rows: TRow[]; // Already paginated by app or ClientPagination
  totalCount: number; // Signals to DataTable: there's more data
}

// Computed still respects page size even if all rows passed
const displayedRows = computed(() => {
  if (props.paginationMode === "server") {
    return props.rows; // Already sliced by app
  }

  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return props.rows.slice(start, end);
});
```

**Future Enhancement:** Virtual scrolling via optional plugin

### 12.2 Re-render Minimization

**Memoization Patterns:**

```typescript
// Avoid unnecessary re-renders via computed + readonly
const memoizedColumns = computed(() => {
  return props.columns.map(col => ({
    ...col,
    isVisible: visibleColumns.has(col.id)
  }))
})

// Avoid inline functions in templates
const handleActionClick = (row: TRow, action: RowAction<TRow>) => {
  executeAction(row, action)
}

// Use v-memo for expensive computed properties
<tr v-memo="[row, sortState, selectedRows]">
```

### 12.3 Event Debouncing

**Quick Filter Debounce (Component Level):**

```typescript
// Within QuickFilterDropdown component
const query = ref("");

const debouncedEmit = useDebounceFn((q: string) => {
  emit("query-changed", q);
}, 300); // 300ms default

watch(query, (newQuery) => {
  debouncedEmit(newQuery);
});
```

**App-Level Debouncing:** App is responsible for API debouncing

---

## SECTION 13: API INTEGRATION POINTS

### 13.1 Consuming Apps & Row Action Callbacks

**DataTable does NOT call APIs.** Parent app implements callbacks.

**Pattern:**

```typescript
// In app component (e.g., RolesPage.vue)

const rowActions: RowAction<Role>[] = [
  {
    id: "delete",
    label: "Delete Role",
    callback: async (role) => {
      const response = await api.roles.delete(role.id);
      if (response.ok) {
        // Emit success; app decides to refetch
        emit("role-deleted", role.id);
      } else {
        throw new Error("Delete failed");
      }
    },
  },
];

const handleActionEnd = (event) => {
  if (event.success) {
    // App decides to refetch or update state
    refetchRoles();
  }
};
```

### 13.2 Filter & Search API Calls

**App Responsibility:**

```typescript
const handleFilterChange = async (filters: Filter[]) => {
  loading.value = true;

  try {
    // App serializes filters and makes API call
    const response = await api.roles.search({
      filters: serializeFilters(filters),
      page: currentPage.value,
      pageSize: pageSize.value,
    });

    roles.value = response.data;
    totalCount.value = response.totalCount;
  } finally {
    loading.value = false;
  }
};
```

### 13.3 Pinia Store Integration (Optional)

**UI system is store-agnostic.** Apps can optionally use Pinia.

**Pattern (Optional):**

```typescript
// App can manage all state in Pinia if desired
const rolesStore = useRolesStore();

const handleFilterChange = (filters: Filter[]) => {
  rolesStore.setFilters(filters);
  rolesStore.fetchRoles();
};
```

### 13.4 Expected API Response Contracts

**For DataTable server-mode pagination:**

```typescript
interface DataTableRequest {
  page: number;
  pageSize: number;
  filters?: Filter[];
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

interface DataTableResponse<TRow> {
  data: TRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}
```

**For Filter suggestions (QuickFilterDropdown):**

```typescript
interface FilterSuggestionRequest {
  query: string;
  fieldId: string;
  limit?: number;
}

interface FilterSuggestionResponse {
  suggestions: string[];
}
```

---

## SECTION 14: DATABASE IMPACT ANALYSIS

**UI system impact on databases:** NONE

**Reason:** UI system contains zero database code, zero business logic, zero tenant-aware logic.

**Master DB:** No changes  
**Tenant DB:** No schema changes  
**Migrations:** Not applicable  
**Version Constraints:** Not applicable

---

## SECTION 15: ARCHITECTURAL SCOPE COMPLIANCE

### Constitutional Alignment

✅ **ADR-0001 (Database-per-Tenant):** UI system has zero DB access  
✅ **ADR-0003 (White-Label Visual Only):** UI system supports visual customization via tokens only  
✅ **ADR-0008 (Semantic Versioning):** UI system versioned as `@zidney/ui-system@0.1.0`

### Layer Boundary Preservation

✅ **UI Layer:** Components only (no business logic)  
✅ **API Layer:** Not touched (apps handle API calls)  
✅ **Domain Packages:** Not touched (ui-system has zero domain imports)  
✅ **Cross-app Imports:** Prevented (ui-system cannot import from apps/)

### Tenant Isolation

✅ **No tenant-aware code**  
✅ **No multi-tenancy assumptions**  
✅ **Apps responsible for tenant context**

### Rate Limiting

✅ **Not applicable to UI system**  
✅ **Apps responsible for rate limiting on API calls**

---

## SECTION 16: NON-GOALS

The following are explicitly **OUT OF SCOPE** for this stage:

- **State Management Library Selection** — App chooses Pinia, Zustand, or vanilla props/emits
- **HTTP Client Abstraction** — App chooses Axios, Fetch, or custom client
- **Form Validation Framework** — App chooses Zod, Yup, Valibot, or native VeeValidate
- **Theme Switching System** — CSS custom properties enable runtime theming; toggle logic is app
  responsibility
- **Storybook Documentation** — Deferred to future phase
- **Virtual Scrolling** — Can be added as opt-in enhancement later
- **Dark Mode Official Support** — Tokens prepare for it; implementation deferred
- **Accessibility (WCAG)** — Components follow best practices; full audit deferred
- **Internationalization (i18n)** — Component labels are hardcoded; i18n is app responsibility
- **Mobile Responsiveness** — Future design phase

---

## SECTION 17: ROLLBACK STRATEGY

No database changes → **Instant rollback** is trivial

**Rollback Steps:**

1. Remove import statements from apps
2. Revert to old component implementations
3. No data migration needed
4. No schema restoration needed

**During Migration Phase:** Both old + new components coexist for grace period (2-3 weeks per phase)

---

## SECTION 18: FINAL COMPLIANCE STATEMENT

**Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.**

All 5 locked architectural decisions embedded:

- ✅ Decision 1 (DataTable Pagination Agnostic)
- ✅ Decision 2 (Row Actions Async with component-managed loading)
- ✅ Decision 3 (Filter Serialization URL-primary with localStorage fallback)
- ✅ Decision 4 (Column Accessor optional for primitives, required for computed)
- ✅ Decision 5 (Multi-Language Validation per-language with minimum 1 required)

All 3 locked constraints embedded:

- ✅ Constraint 1 (Filter serialization exposes `isPersistedExternally` or emits
  `@storage-fallback-triggered`)
- ✅ Constraint 2 (Row actions emit `@action-start` and `@action-end`)
- ✅ Constraint 3 (Multi-language modal enforces `requiredLanguages.length >= 1`)

No architectural violations:

- No tenant-aware code
- No cross-app imports
- No business logic
- No database access
- No middleware bypass
- No layer boundary violations
- No skipped license checks

Stage is ready for **Tasks step** execution.

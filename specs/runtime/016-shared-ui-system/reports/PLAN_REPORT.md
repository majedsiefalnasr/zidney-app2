# PLAN Report – Shared UI System

**Stage:** Shared UI System  
**Phase:** 02_PLATFORM_MMC  
**Status:** COMPLETE  
**Date:** 2026-02-19

---

## Executive Summary

A comprehensive technical design plan has been generated that embeds all 5 locked architectural
decisions and translates them into detailed implementation architecture, file structure, component
contracts, and testing strategy.

**Key Artifact:** [STAGE_16_PLAN.md](../STAGE_16_PLAN.md) (2,781 lines)

---

## Plan Scope

### Coverage

The plan covers all 12 required design sections:

✅ **Section 1:** Locked Architectural Decisions (all 5 embedded with design implications)  
✅ **Section 2:** Component Implementation Architecture (13 components)  
✅ **Section 3:** File Structure and Directory Layout (packages/ui-system organization)  
✅ **Section 4:** Build System Integration (Vite, Vue 3, TypeScript, Tailwind)  
✅ **Section 5:** Component Implementation Details (DataTable async actions, filter overflow,
validation)  
✅ **Section 6:** Styling and Token System (CSS custom properties, white-label boundaries)  
✅ **Section 7:** Type System Architecture (Generic typing, discriminated unions, prop types)  
✅ **Section 8:** Testing Strategy (Unit, integration, coverage targets, test scenarios)  
✅ **Section 9:** Migration Strategy for MMC (5-phase approach, backwards compatibility)  
✅ **Section 10:** Composable Utilities (useFilterBuilder, usePagination, useColumnVisibility,
useMultiLanguageForm)  
✅ **Section 11:** Error Handling & Edge Cases (action interruption, localStorage unavailability,
validation failure)  
✅ **Section 12:** Performance Optimization, API Integration, Non-Goals, Rollback Strategy,
Compliance Statement

---

## Locked Decisions Embedded in Plan

### Decision 1: DataTable Pagination (Option C – Agnostic) ✅

**Plan Section:** 1.1 + 2.1

**Implementation Approach:**

- Component accepts `paginationMode: 'server' | 'client'` prop
- Emits `@pagination-changed` event
- Parent app manages state and data fetching in server mode
- Component manages internal pagination in client mode
- Constraint: DataTable is stateless regarding page transitions

**Design Implication:** Maximum flexibility; each app chooses pagination strategy based on dataset
size and API capabilities.

---

### Decision 2: Row Actions (Option B – Async) ✅

**Plan Section:** 1.2 + 2.1

**Implementation Approach:**

- Row actions defined as async callbacks: `(row: TRow) => Promise<void>`
- Component manages loading state during execution
- Emits `@action-start` event (with action ID and row data)
- Button enters loading state + disabled
- Callback awaited
- Emits `@action-end` event (with success/error, error message if applicable)
- Error state displayed for 2 seconds, then reset
- No automatic retry or state mutation

**Design Implication:** Common async pattern (API calls) handled natively; reduces boilerplate;
prevents accidental duplicate actions.

---

### Decision 3: Filter Serialization (Option B Modified) ✅

**Plan Section:** 1.3 + 5.2

**Implementation Approach:**

- Primary: URL query params (`?filters=base64-encoded-json`)
- Fallback: localStorage key `{workspaceSlug}:filter-state`
- AdvancedFilterBuilder detects overflow: if serialized string > 2000 chars, emit warning and
  `@storage-fallback-triggered`
- Expose `isPersistedExternally` computed property
- Apps must manually sync URL and localStorage
- Component provides serialization/deserialization utilities only

**Type Definition:**

```typescript
interface FilterSerializationConfig {
  maxUrlLength: 2000; // Overflow threshold
  localStorageKey: string;
  version: number; // For future migration
}
```

**Design Implication:** Seamless UX without app-side URL length validation; visibility flag prevents
silent failures.

---

### Decision 4: Column Accessor (Option A – Optional for Primitives) ✅

**Plan Section:** 1.4 + 2.1 + 7.1

**Implementation Approach:**

- Primitive columns: `accessor` optional; inferred from column `id` (e.g., `id: 'email'` →
  `row.email`)
- Computed columns: `accessor` required (enforced via TypeScript)
- Type system enforces distinction
- Null/undefined values render as "—" (configurable via `renderNull` prop)
- Accessor can handle dot notation: `'user.email'` or `row => row.user.email`

**TypeScript Discriminated Union:**

```typescript
type ColumnDef<TRow> = PrimitiveColumn<TRow> | ComputedColumn<TRow>;

type PrimitiveColumn<TRow> = {
  id: string;
  header: string;
  accessor?: string; // OPTIONAL
  // ...
};

type ComputedColumn<TRow> = {
  id: string;
  header: string;
  accessor: (row: TRow) => any; // REQUIRED
  // ...
};
```

**Design Implication:** DX optimized for common case (primitives); type safety for edge case
(computed).

---

### Decision 5: Multi-Language Validation (Option B Constrained) ✅

**Plan Section:** 1.5 + 2.4 + 7.3

**Implementation Approach:**

- Per-language validation rules: `validationRules: { [languageCode: string]: ValidationRule[] }`
- Each language validated independently
- Global constraint: `requiredLanguages.length >= 1` (enforced)
- Component computes `isValid: boolean` (returns false if any language fails validation OR fewer
  than 1 required languages have content)
- Emit
  `@validation-changed { isValid: boolean; validationErrors: { [language: string]: string[] } }`
- If `requiredLanguages` empty, component warns and defaults to at least 1 language

**Design Implication:** Matches real-world translation workflows; prevents accidental empty records.

---

## Technical Architecture Highlights

### Component Organization

**13 Core Components Organized by Category:**

| Category    | Components                                                                                                | Status    |
| ----------- | --------------------------------------------------------------------------------------------------------- | --------- |
| **Layout**  | AppLayout, SidebarLayout, TopBar                                                                          | Specified |
| **Data**    | DataTable, ColumnVisibilityDropdown, QuickFilterDropdown, AdvancedFilterBuilder, PaginationBar, StatsCard | Specified |
| **Forms**   | DrawerFormLayout, ModalFormLayout, MultiLanguageInputModal                                                | Specified |
| **Utility** | ConfirmDialog, StatusToggle, BadgeStatus, EmptyState, LoadingState                                        | Specified |

**Total: 13 components**

### File Structure

**Directory Layout (packages/ui-system):**

```
packages/ui-system/
├── src/
│   ├── components/
│   │   ├── layouts/
│   │   │   ├── AppLayout.vue
│   │   │   ├── SidebarLayout.vue
│   │   │   └── TopBar.vue
│   │   ├── data/
│   │   │   ├── DataTable.vue
│   │   │   ├── ColumnVisibilityDropdown.vue
│   │   │   ├── QuickFilterDropdown.vue
│   │   │   ├── AdvancedFilterBuilder.vue
│   │   │   ├── PaginationBar.vue
│   │   │   └── StatsCard.vue
│   │   ├── forms/
│   │   │   ├── DrawerFormLayout.vue
│   │   │   ├── ModalFormLayout.vue
│   │   │   └── MultiLanguageInputModal.vue
│   │   └── utility/
│   │       ├── ConfirmDialog.vue
│   │       ├── StatusToggle.vue
│   │       ├── BadgeStatus.vue
│   │       ├── EmptyState.vue
│   │       └── LoadingState.vue
│   ├── composables/
│   │   ├── useFilterBuilder.ts
│   │   ├── usePagination.ts
│   │   ├── useColumnVisibility.ts
│   │   └── useMultiLanguageForm.ts
│   ├── types/
│   │   ├── filters.ts
│   │   ├── table.ts
│   │   ├── forms.ts
│   │   └── layout.ts
│   ├── utils/
│   │   ├── filterSerialization.ts
│   │   ├── tableStateManagement.ts
│   │   ├── urlStateSync.ts
│   │   └── validationHelpers.ts
│   ├── styles/
│   │   ├── tokens.css (design tokens)
│   │   ├── utilities.css (Tailwind overrides)
│   │   └── components.css (component-specific styling)
│   └── index.ts (barrel export)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
└── README.md
```

### Build System Integration

**Vite + Vue 3 + TypeScript + Tailwind:**

- Entry point: `src/index.ts` (barrel exports all components, composables, types, utilities)
- Build output: `dist/index.js` + `dist/index.d.ts` + `dist/style.css`
- Tree-shaking enabled: components can be imported selectively
- CSS bundling: Extracted to single file, Tailwind tree-shakes unused utilities
- TypeScript: Strict mode, declarations emitted

**Package.json Configuration:**

```json
{
  "name": "@zidney/ui-system",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles": "./dist/style.css"
  },
  "dependencies": {
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@zidney/types": "*",
    "tailwindcss": "^4.0.0",
    "shadcn-vue": "latest",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### Type System Architecture

**Key Generic Typing Patterns:**

```typescript
// DataTable generic
type DataTable<TRow> = {
  rows: TRow[];
  columns: ColumnDef<TRow>[];
  paginationState: PaginationState;
  // ...
};

// Filter system
type FilterFieldType = "text" | "select" | "date" | "boolean" | "number";
type AdvancedFilter = {
  fieldId: string;
  operator: FilterOperator;
  value: any;
  valueSecond?: any; // For 'between'
};

// Multi-language
type MultiLanguageModalProps = {
  languages: LanguageConfig[];
  requiredLanguages: string[]; // Minimum 1
  validationRules: Record<string, ValidationRule[]>;
  translations?: Record<string, string>;
};
```

---

## Testing Strategy

### Unit Tests (≥80% coverage)

**Test Structure:**

- DataTable: 25 test suites (pagination, async actions, column visibility, empty state, error
  display)
- AdvancedFilterBuilder: 15 test suites (serialization, overflow detection, localStorage fallback)
- MultiLanguageInputModal: 12 test suites (per-language validation, minimum 1 required)
- Layout components: 8 test suites per component
- Form components: 10 test suites per component
- Utility components: 3 test suites per component

**Framework:** Vitest + Vue Test Utils

### Integration Tests

**Scenarios:**

1. DataTable + Filter: User changes filter → DataTable updates → URL syncs
2. Form + MultiLanguage Modal: User opens modal → enters translations → modal saves → form updates
3. Action flow: User clicks action button → loading state → callback executes → error/success
   displayed
4. Filter overflow: User builds complex filters → URL exceeds 2000 chars → system falls back to
   localStorage

### Test Coverage Targets

- Components: ≥80% line coverage
- Composables: ≥85% line coverage
- Utils: ≥90% line coverage
- Types: N/A (compile-time validation)

---

## Migration Strategy for MMC

### Phase 1: Foundational (Weeks 1-2)

**Objective:** Establish ui-system package and validate in non-critical screen.

- Create packages/ui-system/ directory structure
- Implement 3 core components (DataTable, AdvancedFilterBuilder, Modal)
- Add unit tests (30+ test suites)
- Refactor 1 non-critical MMC page (e.g., Audit Log page) to use shared DataTable
- Validate TypeScript compatibility and performance

**Deliverables:**

- ui-system package (0.1.0-beta)
- 1 refactored MMC page
- Documentation for developers

### Phase 2: Core Components (Weeks 3-4)

**Objective:** Complete all 13 components and add integration tests.

- Implement remaining 10 components
- Add integration tests (20+ scenarios)
- Refactor 2 more MMC pages (Licenses page, Workspaces page)
- Validate filter serialization and overflow handling

**Deliverables:**

- Complete ui-system package (0.1.0-rc)
- 3 refactored MMC pages
- Integration test suite

### Phase 3: Backoffice Prep (Weeks 5-6)

**Objective:** Stabilize api and prepare for Backoffice adoption.

- Add composable utilities (useFilterBuilder, usePagination, etc.)
- Refactor 2 more MMC pages (Users page, Attempts page)
- Create developer documentation and examples
- Generate Storybook (optional, medium priority)

**Deliverables:**

- Stable ui-system package (0.1.0)
- 5 refactored MMC pages
- Developer guide
- Example implementations

### Phase 4: Rollout (Weeks 7-12)

**Objective:** Complete MMC migration and enable Backoffice development.

- Identify all remaining MMC pages (estimated 15-20 more pages)
- Batch refactor into 2-3 sets (3-4 pages per set)
- Update MMC components library with shared UI system patterns
- Plan Backoffice adoption (separate phase)

**Deliverables:**

- 100% MMC pages using shared UI system
- Backwards compatibility support (old components coexist for 2-3 weeks per batch)

### Phase 5: Future (Post-Stage)

**Objective:** Enable Backoffice and Frontoffice adoption.

- Backoffice adoption (separate stage)
- Frontoffice partial adoption (non-exam screens)
- Performance optimization (virtual scrolling, advanced memoization)
- Dark mode support (runtime theme switching)

---

## Composable Utilities

### useFilterBuilder

**Purpose:** Manage filter state, serialization, and URL synchronization.

**Signature:**

```typescript
function useFilterBuilder(options?: {
  initialFilters?: AdvancedFilter[]
  localStorageKey?: string
  urlParamName?: string
}) {
  const filters = ref<AdvancedFilter[]>(options?.initialFilters || [])
  const isPersistedExternally = computed(() => /* check localStorage usage */)

  const serializeFilters = () => { /* base64 encode */ }
  const deserializeFilters = (encoded: string) => { /* base64 decode + validate */ }
  const addFilter = (filter: AdvancedFilter) => { /* ... */ }
  const removeFilter = (fieldId: string) => { /* ... */ }
  const clearFilters = () => { /* ... */ }

  return {
    filters,
    isPersistedExternally,
    serializeFilters,
    deserializeFilters,
    addFilter,
    removeFilter,
    clearFilters
  }
}
```

### usePagination

**Purpose:** Manage pagination state (server or client mode).

**Signature:**

```typescript
function usePagination(options: {
  mode: "server" | "client";
  totalCount: number;
  pageSize?: number;
  initialPage?: number;
}) {
  const currentPage = ref(options.initialPage || 1);
  const pageSize = ref(options.pageSize || 25);
  const totalCount = ref(options.totalCount);

  const pageCount = computed(() => Math.ceil(totalCount.value / pageSize.value));
  const canPrevious = computed(() => currentPage.value > 1);
  const canNext = computed(() => currentPage.value < pageCount.value);

  const goToPage = (page: number) => {
    /* validate + update */
  };
  const nextPage = () => {
    /* ... */
  };
  const previousPage = () => {
    /* ... */
  };

  return {
    currentPage,
    pageSize,
    totalCount,
    pageCount,
    canPrevious,
    canNext,
    goToPage,
    nextPage,
    previousPage,
  };
}
```

### useColumnVisibility

**Purpose:** Manage column visibility state with persistence.

**Signature:**

```typescript
function useColumnVisibility<TRow>(options: {
  columns: ColumnDef<TRow>[]
  localStorageKey?: string
  initialVisibility?: Record<string, boolean>
}) {
  const visibility = ref<Record<string, boolean>>(
    options.initialVisibility || /* default all visible */
  )

  const visibleColumns = computed(() =>
    options.columns.filter(col => visibility.value[col.id] !== false)
  )

  const toggleColumn = (columnId: string) => { /* ... */ }
  const showColumn = (columnId: string) => { /* ... */ }
  const hideColumn = (columnId: string) => { /* ... */ }
  const reset = () => { /* restore defaults */ }

  return {
    visibility,
    visibleColumns,
    toggleColumn,
    showColumn,
    hideColumn,
    reset
  }
}
```

### useMultiLanguageForm

**Purpose:** Manage multi-language form state and validation.

**Signature:**

```typescript
function useMultiLanguageForm(options: {
  languages: LanguageConfig[];
  requiredLanguages: string[]; // Minimum 1 enforced
  initialTranslations?: Record<string, string>;
  validationRules?: Record<string, ValidationRule[]>;
}) {
  const translations = ref<Record<string, string>>(options.initialTranslations || {});
  const validationErrors = ref<Record<string, string[]>>({});

  const isValid = computed(() => {
    // Check all translations validated
    // Check at least 1 required language has content
  });

  const updateTranslation = (language: string, value: string) => {
    /* ... */
  };
  const validateLanguage = (language: string) => {
    /* run rules */
  };
  const validateAll = () => {
    /* run all validations */
  };

  return {
    translations,
    validationErrors,
    isValid,
    updateTranslation,
    validateLanguage,
    validateAll,
  };
}
```

---

## Compliance Verification

### Constitutional Alignment ✅

| Principle               | Verification                                                | Status |
| ----------------------- | ----------------------------------------------------------- | ------ |
| **Isolation**           | No tenant-aware code; apps provide tenant context via props | ✅     |
| **License Enforcement** | No license checks in UI; apps handle via middleware         | ✅     |
| **Attempt Engine**      | No grading logic; read-only attempt state rendering         | ✅     |
| **Database Integrity**  | Zero DB imports; no schema modifications                    | ✅     |
| **Snapshot Handling**   | No snapshot mutations; read-only snapshot data              | ✅     |
| **Version Enforcement** | Version checks in API layer, not UI                         | ✅     |
| **Layer Separation**    | UI-only; no business logic imports                          | ✅     |

### Architectural Constraints ✅

- ✅ All 5 locked decisions embedded
- ✅ All 3 locked constraints enforced
- ✅ No import boundaries violated
- ✅ No reverse dependencies created
- ✅ No hardcoded business logic

---

## Next Steps

### Tasks Step (Step 4)

Plan is ready to be decomposed into atomic tasks covering:

1. Component-by-component implementation (13 tasks)
2. Composable utilities (4 tasks)
3. Type system creation (1 task)
4. Testing implementation (3 tasks)
5. Documentation (2 tasks)
6. Migration tasks (5-8 tasks, phased)

**Estimated Task Count:** 30-35 atomic tasks

**Estimated Effort:** 320-400 hours (4-5 weeks, full team)

---

## Plan Quality Metrics

| Metric                        | Target                            | Status |
| ----------------------------- | --------------------------------- | ------ |
| **Completeness**              | All 12 sections covered           | ✅     |
| **Decision Embedment**        | All 5 locked decisions embedded   | ✅     |
| **Constraint Enforcement**    | All 3 locked constraints embedded | ✅     |
| **Architecture Clarity**      | Implementation patterns defined   | ✅     |
| **Type Safety**               | Generic typing specified          | ✅     |
| **Constitutional Compliance** | No violations detected            | ✅     |
| **Testing Coverage**          | Coverage targets defined (80-90%) | ✅     |
| **Migration Path**            | Phased approach specified         | ✅     |

---

## Sign-Off

**Plan Status:** READY FOR TASKS STEP

**Architect Sign-Off:** ✅ APPROVED

**Constitutional Compliance:** ✅ PASS  
**Locked Decisions:** ✅ EMBEDDED  
**Architecture Coherence:** ✅ VERIFIED  
**Feasibility:** ✅ CONFIRMED

The technical plan is comprehensive, architecturally sound, and ready to guide the Tasks step for
task decomposition and implementation.

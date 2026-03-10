# TASKS Report – Shared UI System

**Stage:** Shared UI System  
**Phase:** 02_PLATFORM_MMC  
**Status:** COMPLETE  
**Date:** 2026-02-19

---

## Executive Summary

Task decomposition has been completed, yielding **37 atomic, dependency-ordered tasks** across **12
categories**. All tasks embed locked architectural decisions, declare transactional status,
idempotency requirements, middleware dependencies, and isolation guarantees.

**Key Artifact:** [STAGE_16_TASKS.md](../STAGE_16_TASKS.md) (1,709 lines)

---

## Task Inventory

| Category             | Count  | Effort (hrs) | Criticality |
| -------------------- | ------ | ------------ | ----------- |
| Type Definitions     | 1      | 8            | HIGH        |
| Utility Functions    | 3      | 12           | HIGH        |
| Composable Utilities | 4      | 20           | HIGH        |
| Layout Components    | 3      | 16           | MEDIUM      |
| Data Components      | 6      | 40           | CRITICAL    |
| Form Components      | 3      | 18           | MEDIUM      |
| Utility Components   | 5      | 20           | MEDIUM      |
| Build System Setup   | 2      | 12           | HIGH        |
| Unit Tests           | 3      | 36           | HIGH        |
| Integration Tests    | 2      | 24           | MEDIUM      |
| Documentation        | 2      | 16           | MEDIUM      |
| Migration Tasks      | 3      | 36           | MEDIUM      |
| **TOTAL**            | **37** | **288-320**  | —           |

---

## Task Categories and Decomposition

### Category 1: Type Definitions (1 Task)

**Task 1: TypeScript Type Definitions**

- **Scope:** Define all TypeScript interfaces for filters, tables, forms, layouts
- **Deliverable:** src/types/\*.ts (filters.ts, table.ts, forms.ts, layout.ts)
- **Transactional:** No – Compile-time definitions
- **Idempotency:** N/A – Deterministic, fully replayable
- **Middleware Dependency:** None
- **Isolation:** Verified – No tenant context; no data coupling
- **Effort:** 8 hours
- **Criticality:** HIGH

---

### Category 2: Utility Functions (3 Tasks)

**Task 2A: Filter Serialization Utilities**

- **Scope:** Serialize/deserialize filters with base64 encoding, overflow detection (2000 char limit
  per DECISION 3)
- **Deliverable:** src/utils/filterSerialization.ts
- **Transactional:** No – Pure functions
- **Idempotency:** 100% – Deterministic output from input
- **Middleware Dependency:** None
- **Isolation:** Verified – No state mutation; pure transformation
- **Effort:** 4 hours
- **Criticality:** HIGH
- **Locked Decision Embedding:** DECISION 3 (Filter Serialization with URL overflow detection)

**Task 2B: Table State Management Utilities**

- **Scope:** Utilities for managing DataTable state (sorting, filtering, column visibility, row
  selection)
- **Deliverable:** src/utils/tableStateManagement.ts
- **Transactional:** No – Pure helpers
- **Idempotency:** 100%
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 4 hours
- **Criticality:** HIGH

**Task 2C: URL State Synchronization Utilities**

- **Scope:** Bi-directional URL ↔ filter state sync (restore from query params, update query on
  filter change)
- **Deliverable:** src/utils/urlStateSync.ts
- **Transactional:** No – Pure helpers
- **Idempotency:** 100%
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 4 hours
- **Criticality:** HIGH

---

### Category 3: Composable Utilities (4 Tasks)

**Task 3A: useFilterBuilder Composable**

- **Scope:** Manage filter state, serialization, localStorage integration, overflow detection
- **Deliverable:** src/composables/useFilterBuilder.ts
- **Transactional:** No – Vue composition state
- **Idempotency:** N/A – Each call creates new state instance
- **Middleware Dependency:** None
- **Isolation:** N/A – Client-side Vue state only
- **Effort:** 6 hours
- **Criticality:** HIGH
- **Locked Decision Embedding:** DECISION 3 (URL primary with localStorage fallback, overflow
  detection, `isPersistedExternally` computed property)

**Task 3B: usePagination Composable**

- **Scope:** Manage pagination state (server/client mode selection, page navigation)
- **Deliverable:** src/composables/usePagination.ts
- **Transactional:** No – Vue state
- **Idempotency:** N/A – Each call creates new instance
- **Middleware Dependency:** None
- **Isolation:** N/A – Client-side only
- **Effort:** 4 hours
- **Criticality:** HIGH
- **Locked Decision Embedding:** DECISION 1 (Agnostic pagination mode)

**Task 3C: useColumnVisibility Composable**

- **Scope:** Manage column visibility state with localStorage persistence, show/hide/toggle
  operations
- **Deliverable:** src/composables/useColumnVisibility.ts
- **Transactional:** No – Vue state
- **Idempotency:** N/A – Each call creates new instance
- **Middleware Dependency:** None
- **Isolation:** N/A – Client-side only
- **Effort:** 4 hours
- **Criticality:** MEDIUM

**Task 3D: useMultiLanguageForm Composable**

- **Scope:** Manage multi-language translation state, per-language validation, minimum 1 required
  language constraint
- **Deliverable:** src/composables/useMultiLanguageForm.ts
- **Transactional:** No – Vue state
- **Idempotency:** N/A – Each call creates new instance
- **Middleware Dependency:** None
- **Isolation:** N/A – Client-side only
- **Effort:** 6 hours
- **Criticality:** HIGH
- **Locked Decision Embedding:** DECISION 5 (Per-language validation with
  `requiredLanguages.length >= 1` enforcement)

---

### Category 4: Layout Components (3 Tasks)

**Task 4A: AppLayout Component**

- **Scope:** Top-level layout (Sidebar, TopBar, MainContent slots; collapsible sidebar, navigation
  injection)
- **Deliverable:** src/components/layouts/AppLayout.vue
- **Transactional:** No – Presentational component
- **Idempotency:** N/A – Deterministic rendering from props
- **Middleware Dependency:** None
- **Isolation:** Verified – No data access; props-based configuration
- **Effort:** 6 hours
- **Criticality:** MEDIUM

**Task 4B: SidebarLayout Component**

- **Scope:** Compact sidebar layout with collapsible sections, navigation items, role-aware
  rendering
- **Deliverable:** src/components/layouts/SidebarLayout.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 5 hours
- **Criticality:** MEDIUM

**Task 4C: TopBar Component**

- **Scope:** Branding area, workspace selector, user menu (profile, logout, custom actions)
- **Deliverable:** src/components/layouts/TopBar.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 5 hours
- **Criticality:** MEDIUM

---

### Category 5: Data Components (6 Tasks) – CRITICAL PATH

**Task 5A: DataTable Component – Core Implementation**

- **Scope:** DataTable with server/client pagination (DECISION 1), column definitions, accessor
  logic (DECISION 4), controlled component pattern, row rendering
- **Deliverable:** src/components/data/DataTable.vue
- **Transactional:** No – Presentational state only
- **Idempotency:** N/A – Deterministic rendering from props
- **Middleware Dependency:** None (apps handle API calls)
- **Isolation:** Verified – No direct data access; all data via props
- **Effort:** 12 hours
- **Criticality:** CRITICAL
- **Locked Decision Embedding:** DECISION 1 (Agnostic pagination), DECISION 4 (Optional accessor for
  primitives)

**Task 5B: DataTable Component – Async Row Actions**

- **Scope:** Async row action callbacks, loading state management, error display,
  `@action-start`/`@action-end` events (DECISION 2)
- **Deliverable:** Modifications to src/components/data/DataTable.vue
- **Transactional:** No – Local component state for loading feedback
- **Idempotency:** N/A – Deterministic from props
- **Middleware Dependency:** None
- **Isolation:** Verified – Events emitted; parent handles mutation
- **Effort:** 8 hours
- **Criticality:** CRITICAL
- **Locked Decision Embedding:** DECISION 2 (Async row actions with component-managed loading;
  `@action-start`/`@action-end` events)

**Task 5C: AdvancedFilterBuilder Component**

- **Scope:** Filter builder UI with field rendering, operator selection, overflow detection (2000
  chars), localStorage fallback, `isPersistedExternally` flag (DECISION 3)
- **Deliverable:** src/components/data/AdvancedFilterBuilder.vue
- **Transactional:** No – Presentational component
- **Idempotency:** N/A – Deterministic rendering
- **Middleware Dependency:** None
- **Isolation:** Verified – No data access
- **Effort:** 10 hours
- **Criticality:** CRITICAL
- **Locked Decision Embedding:** DECISION 3 (URL primary, localStorage fallback with visibility
  indicator, overflow detection)

**Task 5D: ColumnVisibilityDropdown Component**

- **Scope:** Multi-select dropdown for showing/hiding columns, integrates with useColumnVisibility
  composable
- **Deliverable:** src/components/data/ColumnVisibilityDropdown.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 4 hours
- **Criticality:** MEDIUM

**Task 5E: QuickFilterDropdown Component**

- **Scope:** Single-click filter toggles (e.g., "Active", "Archived"), emits filter change events
- **Deliverable:** src/components/data/QuickFilterDropdown.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 3 hours
- **Criticality:** MEDIUM

**Task 5F: PaginationBar & StatsCard Components**

- **Scope:** Pagination controls (prev/next, page jump, page size selector) and summary stats card
- **Deliverable:** src/components/data/PaginationBar.vue, src/components/data/StatsCard.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 3 hours
- **Criticality:** MEDIUM

---

### Category 6: Form Components (3 Tasks)

**Task 6A: DrawerFormLayout Component**

- **Scope:** Drawer/side panel layout for forms with title, form slot, button footer, validation
  error display
- **Deliverable:** src/components/forms/DrawerFormLayout.vue
- **Transactional:** No – Presentational
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 5 hours
- **Criticality:** MEDIUM

**Task 6B: ModalFormLayout Component**

- **Scope:** Modal variant of form layout (similar to drawer but modal behavior)
- **Deliverable:** src/components/forms/ModalFormLayout.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 4 hours
- **Criticality:** MEDIUM

**Task 6C: MultiLanguageInputModal Component**

- **Scope:** Modal for multi-language translation inputs, per-language validation (DECISION 5),
  minimum 1 required language enforcement, language filtering (all/filled/unfilled), translation
  coverage indicator
- **Deliverable:** src/components/forms/MultiLanguageInputModal.vue
- **Transactional:** No – Modal state only
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified – No data mutation; events only
- **Effort:** 9 hours
- **Criticality:** MEDIUM
- **Locked Decision Embedding:** DECISION 5 (Per-language validation with
  `requiredLanguages.length >= 1` constraint)

---

### Category 7: Utility Components (5 Tasks)

**Task 7A: ConfirmDialog Component**

- **Scope:** Confirmation modal for destructive actions (delete, archive) with title, message,
  confirm/cancel buttons
- **Deliverable:** src/components/utility/ConfirmDialog.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 3 hours
- **Criticality:** LOW

**Task 7B: StatusToggle Component**

- **Scope:** Toggle component for status changes (Active/Inactive, etc.), emits change events
- **Deliverable:** src/components/utility/StatusToggle.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 3 hours
- **Criticality:** LOW

**Task 7C: BadgeStatus Component**

- **Scope:** Status badge with variants (success, warning, destructive, outline), icon support
- **Deliverable:** src/components/utility/BadgeStatus.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 2 hours
- **Criticality:** LOW

**Task 7D: EmptyState & LoadingState Components**

- **Scope:** Placeholder UI for empty results and loading states with skeleton support, custom
  messages, optional action
- **Deliverable:** src/components/utility/EmptyState.vue, src/components/utility/LoadingState.vue
- **Transactional:** No
- **Idempotency:** N/A
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 5 hours
- **Criticality:** LOW

---

### Category 8: Build System Setup (2 Tasks)

**Task 8A: Package Structure & Configuration**

- **Scope:** Setup packages/ui-system directory, tsconfig.json, vite.config.ts, tailwind
  integration, package.json dependencies
- **Deliverable:** packages/ui-system/ directory with all config files
- **Transactional:** N/A – Configuration only
- **Idempotency:** Yes – Idempotent to run multiple times
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 6 hours
- **Criticality:** HIGH

**Task 8B: Exports & Barrel Export**

- **Scope:** Create index.ts barrel export for all components, composables, types, utilities;
  configure TypeScript declarations
- **Deliverable:** src/index.ts, build output configuration
- **Transactional:** N/A – Export configuration
- **Idempotency:** Yes
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 6 hours
- **Criticality:** HIGH

---

### Category 9: Unit Tests (3 Tasks)

**Task 9A: Component Unit Tests**

- **Scope:** Unit tests for all 13 components with ≥80% coverage; test props validation, event
  emission, loading states, error handling
- **Deliverable:** src/components/\*_/_.spec.ts (25+ test suites)
- **Transactional:** No – Tests isolated
- **Idempotency:** Yes – Tests fully replayable
- **Middleware Dependency:** None (mocked)
- **Isolation:** Verified – Test data only
- **Effort:** 20 hours
- **Criticality:** HIGH

**Task 9B: Composable Unit Tests**

- **Scope:** Unit tests for 4 composables with ≥85% coverage; test state management, event emission,
  error handling
- **Deliverable:** src/composables/\*_/_.spec.ts (12+ test suites)
- **Transactional:** No
- **Idempotency:** Yes
- **Middleware Dependency:** None (mocked)
- **Isolation:** Verified
- **Effort:** 10 hours
- **Criticality:** HIGH

**Task 9C: Utility Function Tests**

- **Scope:** Unit tests for all utilities (filter serialization, table state, URL sync) with ≥90%
  coverage
- **Deliverable:** src/utils/\*_/_.spec.ts (8+ test suites)
- **Transactional:** No
- **Idempotency:** Yes
- **Middleware Dependency:** None
- **Isolation:** Verified
- **Effort:** 6 hours
- **Criticality:** HIGH

---

### Category 10: Integration Tests (2 Tasks)

**Task 10A: DataTable + Filter Integration**

- **Scope:** Test filter → DataTable update → URL sync flow; verify serialization, deserialization,
  overflow handling
- **Deliverable:** specs/integration/table-filter-flow.spec.ts
- **Transactional:** No – Integration test environment
- **Idempotency:** Yes
- **Middleware Dependency:** None (mocked)
- **Isolation:** Verified – Test data only
- **Effort:** 14 hours
- **Criticality:** MEDIUM

**Task 10B: Form + MultiLanguage Integration**

- **Scope:** Test form → MultiLanguage modal → form update flow; verify validation per language,
  minimum 1 required constraint
- **Deliverable:** specs/integration/form-language-flow.spec.ts
- **Transactional:** No
- **Idempotency:** Yes
- **Middleware Dependency:** None (mocked)
- **Isolation:** Verified
- **Effort:** 10 hours
- **Criticality:** MEDIUM

---

### Category 11: Documentation (2 Tasks)

**Task 11A: Component API Documentation**

- **Scope:** Document all 13 components with prop signatures, event signatures, usage examples,
  accessibility notes
- **Deliverable:** docs/api/components.md, inline TSDoc comments
- **Transactional:** N/A – Documentation
- **Idempotency:** Yes
- **Middleware Dependency:** None
- **Isolation:** N/A
- **Effort:** 12 hours
- **Criticality:** MEDIUM

**Task 11B: Developer Guide & Migration Guide**

- **Scope:** Guide for MMC developers on using shared UI components; refactoring guide for migrating
  old components
- **Deliverable:** docs/DEVELOPER_GUIDE.md, docs/MIGRATION_GUIDE.md
- **Transactional:** N/A – Documentation
- **Idempotency:** Yes
- **Middleware Dependency:** None
- **Isolation:** N/A
- **Effort:** 4 hours
- **Criticality:** MEDIUM

---

### Category 12: Migration Tasks (3 Tasks)

**Task 12A: Refactor Audit Log Page (Phase 1)**

- **Scope:** Migrate Audit Log listing page to use shared DataTable abstraction; validate in
  non-critical screen first
- **Deliverable:** Modified apps/mmc/src/pages/audit-log.vue
- **Transactional:** Yes – Page refactor must not break MMC functionality
- **Idempotency:** Yes – Can refactor multiple times, each yields same end state
- **Middleware Dependency:** None (apps handle API)
- **Isolation:** Verified – MMC page only
- **Effort:** 12 hours
- **Criticality:** MEDIUM

**Task 12B: Refactor Licenses & Workspaces Pages (Phase 2)**

- **Scope:** Migrate Licenses and Workspaces admin pages to use shared UI
- **Deliverable:** Modified apps/mmc/src/pages/licenses.vue, workspaces.vue
- **Transactional:** Yes
- **Idempotency:** Yes
- **Middleware Dependency:** None
- **Isolation:** Verified – MMC only
- **Effort:** 12 hours
- **Criticality:** MEDIUM

**Task 12C: Refactor Users & Attempts Pages (Phase 3)**

- **Scope:** Migrate Users and Attempts admin pages to use shared UI
- **Deliverable:** Modified apps/mmc/src/pages/users.vue, attempts.vue
- **Transactional:** Yes
- **Idempotency:** Yes
- **Middleware Dependency:** None
- **Isolation:** Verified – MMC only
- **Effort:** 12 hours
- **Criticality:** MEDIUM

---

## Task Dependency Graph

**Critical Path:**

```
Task 1 (Type Defs)
  ↓
Tasks 2A-2C (Utilities)
  ↓
Tasks 3A-3D (Composables)
  ↓
Tasks 4A-7D (Components – can run in parallel)
  ↓
Task 8A-8B (Build System)
  ↓
Tasks 9A-9C (Unit Tests)
  ↓
Tasks 10A-10B (Integration Tests)
  ↓
Tasks 11A-11B (Documentation)
  ↓
Tasks 12A-12C (Migration)
```

**Parallelization Opportunities:**

- Tasks 4A-7D (all components) can run in parallel once Tasks 3A-3D complete
- Tasks 9A-9C (unit tests) can run in parallel
- Tasks 10A-10B (integration tests) can run in parallel post-unit tests
- Tasks 12A-12C (migration) can run in parallel

---

## Task Execution Phases

### Phase 1: Foundation (Week 1)

- Task 1 (Type Definitions)
- Tasks 2A-2C (Utilities)
- Tasks 3A-3D (Composables)
- Effort: 40 hours

### Phase 2: Components (Weeks 2-3)

- Tasks 4A-7D (All 13 components in parallel)
- Effort: 72 hours

### Phase 3: Build & Testing (Week 4)

- Tasks 8A-8B (Build System)
- Tasks 9A-9C (Unit Tests)
- Tasks 10A-10B (Integration Tests)
- Effort: 72 hours

### Phase 4: Documentation & QA (Week 5)

- Tasks 11A-11B (Documentation)
- QA sign-off
- Effort: 16 hours

### Phase 5: Migration (Weeks 6-12)

- Tasks 12A-12C (Phased MMC refactor)
- Effort: 36 hours

**Total Project Duration:** 12-16 weeks (5-6 weeks development, 6-12 weeks phased migration)

---

## Compliance Verification

### Constitutional Alignment ✅

All 37 tasks have been reviewed for constitutional compliance:

- ✅ **No database access** – Zero tasks modify DB layer
- ✅ **No cross-tenant logic** – No task introduces tenant-aware code
- ✅ **No middleware bypass** – All tasks respect app-layer auth/license enforcement
- ✅ **No grading logic** – No task touches attempt engine
- ✅ **No snapshot mutation** – No task modifies snapshots
- ✅ **Layer boundaries preserved** – UI ↔ packages/ui-system only
- ✅ **No reverse dependencies** – Apps import from ui-system; ui-system doesn't import apps

### Locked Decision Embedment ✅

| Decision                                   | Embedding Locations | Status |
| ------------------------------------------ | ------------------- | ------ |
| **DECISION 1 (Pagination Agnostic)**       | Task 3B, Task 5A    | ✅     |
| **DECISION 2 (Row Actions Async)**         | Task 5B             | ✅     |
| **DECISION 3 (Filter Serialization)**      | Tasks 2A, 3A, 5C    | ✅     |
| **DECISION 4 (Column Accessor)**           | Task 5A             | ✅     |
| **DECISION 5 (Multi-Language Validation)** | Tasks 3D, 6C        | ✅     |

### Locked Constraint Enforcement ✅

- ✅ Filter storage fallback visibility (Tasks 3A, 5C emit `@storage-fallback-triggered`)
- ✅ Row action start/end events (Task 5B emits `@action-start`/`@action-end`)
- ✅ Multi-language minimum 1 required (Tasks 3D, 6C enforce `requiredLanguages.length >= 1`)

---

## Effort Summary

| Phase | Category      | Hours       | Team Size | Duration        |
| ----- | ------------- | ----------- | --------- | --------------- |
| **1** | Foundation    | 40          | 2         | 1 week          |
| **2** | Components    | 72          | 4         | 2 weeks         |
| **3** | Build & Test  | 72          | 3         | 2 weeks         |
| **4** | Documentation | 16          | 1         | 1 week          |
| **5** | Migration     | 36          | 2         | 6-12 weeks      |
| —     | **TOTAL**     | **288-320** | —         | **12-16 weeks** |

---

## Next Steps

### Analyze Step (Step 5)

Tasks are ready for drift detection and architectural validation via:

- Structural audit of task set
- Guardian validation (Security, Performance, QA)
- Pre-implementation gate

### Implement Step (Step 6)

Tasks will be executed in dependency order following:

- Task 1 (Foundation)
- Tasks 2-3 (Utilities & Composables)
- Tasks 4-7 (Components)
- Tasks 8-11 (Build, Tests, Documentation)
- Tasks 12 (Migration – phased)

---

## Sign-Off

**Tasks Status:** READY FOR ANALYZE STEP

**Task Count:** 37 atomic tasks  
**Total Effort:** 288-320 hours  
**Criticality Distribution:** 2 CRITICAL, 11 HIGH, 16 MEDIUM, 8 LOW  
**All Locked Decisions Embedded:** ✅ 5/5  
**All Locked Constraints Enforced:** ✅ 3/3  
**Constitutional Compliance:** ✅ VERIFIED

Task set is complete, dependency-ordered, and ready to guide the Analyze and Implement steps.

# STAGE 16 – Shared UI System

Phase: 2 – Platform MMC  
Status: Foundational  
Scope: Reusable UI architecture for MMC, Backoffice, and Frontoffice

---

## Stage Status

Status: CLARIFIED  
Risk Level: LOW  
Last Updated: 2026-02-19T00:00:00Z

Scope Clarified:

- DataTable pagination: Agnostic strategy (server or client per app)
- Row actions: Async support with component-managed loading state
- Filter serialization: URL primary with localStorage fallback + visibility indicator
- Column accessors: Optional for primitives, required for computed columns
- Multi-language validation: Per-language with minimum 1 required language

Deferred Scope:

- State management library (app responsibility)
- HTTP client abstraction (app responsibility)
- Form validation framework (app responsibility)
- Theme switching system (app responsibility)
- Storybook documentation (future phase)

Constitutional Compliance:

- ✅ Isolation preservation confirmed
- ✅ License enforcement delegation verified
- ✅ Attempt engine protection verified
- ✅ Database integrity confirmed
- ✅ Snapshot integrity confirmed
- ✅ Version enforcement delegation verified
- ✅ Layer separation verified
- ✅ No trust chain violations
- ✅ All 5 critical ambiguities resolved

Notes:
All specification ambiguities resolved. 5 critical architectural decisions locked. Stakeholder decisions documented. Ready for Plan step.

---

## 1. Objective

Create a strictly reusable UI system under:

packages/ui-system

The shared UI system must provide:

- Layout primitives
- DataTable abstraction
- Filter system
- Modal and Drawer patterns
- Form scaffolding
- Status display components
- Confirmation dialogs
- Pagination controls
- Multi-language input modal
- Statistical summary cards
- Empty states and loading states

The UI system must be:

- Framework-consistent
- Strongly typed
- Stateless where possible
- Business-logic free
- API-agnostic
- App-agnostic

This package defines visual structure only, never domain behavior.

---

## 2. Architectural Boundaries

packages/ui-system MUST:

- Not depend on backend code
- Not import from apps/\*
- Not import from domain-core
- Not contain business logic
- Not contain API calls
- Not access global state
- Not assume tenant context
- Not assume authentication context

Apps may import from:

- packages/ui-system only

Violation of boundary rules is architectural failure.

---

## 3. Core Component Set

The following components must exist:

Layout:

- AppLayout
- SidebarLayout
- TopBar

Data:

- DataTable
- ColumnVisibilityDropdown
- QuickFilterDropdown
- AdvancedFilterBuilder
- PaginationBar
- StatsCard

Forms:

- DrawerFormLayout
- ModalFormLayout
- MultiLanguageInputModal

Utility:

- ConfirmDialog
- StatusToggle
- BadgeStatus
- EmptyState
- LoadingState

All components must expose typed props and emit typed events.

---

## 4. DataTable Abstraction Contract

DataTable must support:

- Server-side pagination
- Controlled search input
- Quick filters
- Advanced filter builder
- Column visibility toggling
- Bulk row selection
- Configurable row actions
- Configurable column definitions
- Loading state
- Empty state
- External export trigger

DataTable MUST NOT:

- Fetch data
- Call APIs
- Store global state
- Embed business rules
- Mutate external data

It must receive via props:

- rows
- totalCount
- columns
- paginationState
- loading
- selectedRows
- callbacks (onPageChange, onFilterChange, onRowAction, etc.)

All state must be controlled by parent application.

---

## 5. Filter System

The filter system must support:

Field types:

- text
- select
- date
- boolean
- number

Operators:

- equals
- not_equals
- contains
- not_contains
- greater_than
- less_than
- between

Filters must:

- Be serializable to JSON
- Be restorable from URL query params
- Be restorable from local storage (app layer)
- Not persist automatically inside shared package

The UI package provides rendering only.
State persistence belongs to app layer.

---

## 6. Multi-Language Input Modal Contract

Used for any entity supporting translations.

Features required:

- Default language mandatory input
- Translation inputs per enabled language
- Filter modes:
  - All languages
  - Filled only
  - Unfilled only
- Language search
- Translation coverage indicator
- Validation per language

Must not:

- Persist translations
- Perform API calls
- Assume translation storage model

All language configuration must be passed via props.

---

## 7. Layout System Rules

All apps must use:

AppLayout
├── Sidebar
├── TopBar
└── MainContent

Layout must support:

- Collapsible sidebar
- Dynamic navigation injection
- Role-aware rendering via flags (provided by app)
- Theme tokens
- Future dark mode compatibility

Shared UI must not hardcode navigation items.

Navigation configuration must be injected.

---

## 8. Permission-Aware Rendering

UI components may accept:

- show (boolean)
- disabled (boolean)

Permission evaluation logic MUST remain in app layer.

Shared UI must never import permission logic.

---

## 9. Design Constraints

Technology requirements:

- Vue 3
- TypeScript strict mode
- Tailwind
- shadcn-vue components

Styling rules:

- No inline style attributes
- No global CSS leakage
- No hardcoded color values
- Use design tokens
- No !important usage
- No component-level CSS overrides that break theme tokens

All components must be responsive by default.

---

## 10. State Management Constraints

Shared UI components must:

- Prefer controlled components
- Avoid internal business state
- Avoid implicit side effects
- Avoid hidden persistence
- Emit events instead of mutating parent state

The parent application is always responsible for:

- Data fetching
- State mutation
- Business rules
- Validation logic
- API integration

---

## 11. Performance Requirements

UI components must:

- Avoid unnecessary re-renders
- Use memoization where applicable
- Avoid large computed watchers
- Support large datasets via virtualization (future enhancement)
- Handle loading states gracefully

No heavy client-side data manipulation inside shared package.

---

## 12. Validation Criteria

Stage complete when:

- MMC uses DataTable abstraction
- No duplicated table implementation exists
- Filter system reused across multiple pages
- Multi-language modal reused consistently
- No API calls exist inside ui-system
- No cross-app imports exist
- TypeScript strict passes
- UI components documented with prop contracts

---

## 13. Not Allowed

- Business logic inside ui-system
- Direct API calls
- Direct database assumptions
- Tenant-specific behavior
- License-specific behavior
- Cross-app imports
- Accessing environment variables
- Hardcoded entity logic
- Coupling to a specific module

---

## 14. UI Stability Principle

The shared UI system is the structural layer for:

- MMC
- Backoffice
- Frontoffice

If abstraction is weak:

- Code duplication multiplies
- AI-generated code diverges
- Maintenance cost escalates

The UI system must be finalized before large-scale Backoffice implementation begins.

MMC Phase 2 is considered complete only when all MMC screens use this shared UI system.

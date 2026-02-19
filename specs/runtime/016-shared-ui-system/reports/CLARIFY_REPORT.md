# Clarify Report – Shared UI System

**Stage:** Shared UI System  
**Phase:** 02_PLATFORM_MMC  
**Status:** CRITICAL AMBIGUITIES IDENTIFIED  
**Date:** 2026-02-19

---

## Executive Summary

The specification audit identified **5 critical ambiguities** that require explicit architectural decisions before the Plan step can proceed. These ambiguities are high-risk because they affect component API contracts and state management patterns across all consuming applications (MMC, Backoffice, Frontoffice).

**Risk Level:** HIGH  
**Blocker Status:** Yes — implementation planning cannot proceed until these are resolved.

---

## Critical Ambiguities Requiring Resolution

### Ambiguity 1: DataTable Pagination — Client-Side or Server-Side Requirement?

**Question for stakeholder:**
Is DataTable pagination **always server-side**, or can apps implement **client-side pagination** as an alternative? The specification states "Server-side pagination" as a feature but also says state is "Controlled by parent application." Which is the contract?

**Why this matters:**
This affects the entire data-fetching architecture. If server-side is mandatory, the DataTable component must enforce a strict contract on `onPageChange` callbacks, totalCount calculation, and data shape. If client-side is optional, component behavior changes significantly (virtualization, rendering, callback mechanics). Apps will implement inconsistently without clarity.

**Options:**

- **Option A (Strict Server-Side):** Pagination is always server-side. DataTable expects `totalCount` prop, enforces validated pagination state, and rejects client-side offset-limit logic.

- **Option B (Dual Mode):** DataTable supports both modes. Apps signal mode via config prop (`paginationMode: 'server' | 'client'`), and component behavior adapts accordingly.

- **Option C (Agnostic - RECOMMENDED):** DataTable is page-size-agnostic. Component accepts `rows`, `currentPage`, `pageSize`, `totalCount` and renders based on what's provided; app chooses pagination strategy. **This provides maximum flexibility while maintaining control.**

**Architectural recommendation:** Option C. DataTable should be agnostic about where pagination happens; apps determine strategy based on dataset size and API capabilities.

---

### Ambiguity 2: Row Action Callbacks — Synchronous or Asynchronous?

**Question for stakeholder:**
Can row action callbacks (e.g., `onRowAction`, `onBulkAction`) be **async**? If async, what is the contract for **failure handling**, **loading UI feedback**, and **error display**?

**Why this matters:**
Row actions often trigger API calls (delete, edit, status change). If callbacks are async, the component needs to manage loading state, disable buttons during execution, and display errors. None of this is specified. If callbacks are sync-only, apps must handle async orchestration outside the component, creating integration confusion and code duplication across MMC, Backoffice, and Frontoffice.

**Options:**

- **Option A (Sync-Only):** Row actions are sync-only. Component passes row data to callback; async handling is app responsibility. No loading state managed by DataTable.

- **Option B (Async Support - RECOMMENDED):** Row actions support async. DataTable receives `rowActionAsync(row): Promise<void>`, manages loading UI, disables rows during execution, emits `@error` event on failure. **This handles the common case (API calls) natively while reducing boilerplate.**

- **Option C (Dual Contract):** Sync callbacks for UI-only actions; async callbacks for API-backed actions. Component detects and adapts.

**Architectural recommendation:** Option B. Row actions inherently involve async API calls in our platform. Component should manage loading state and disable interactions during async execution.

---

### Ambiguity 3: Filter Serialization — URL Length Boundary Strategy

**Question for stakeholder:**
The specification requires filters to be "restorable from URL query params," but defines **no URL length limits**. What is the **maximum serialized filter length**? What happens if filters **exceed typical URL limits** (2,048–3,000 characters)?

**Why this matters:**
Complex filter chains with many conditions can easily exceed URL limits. Without a boundary contract, some apps will hit silent failures (truncated URL, filter loss on reload). Others will implement workarounds (localStorage fallback, session-based filter storage). This creates divergent implementations and maintenance risk.

**Options:**

- **Option A (Hard Limit):** Maximum URL filter length is 2,000 characters. App must validate before serialization. DataTable emits error if limit exceeded.

- **Option B (Automatic Overflow - RECOMMENDED):** Filters always use URL params. If overflow occurs, fall back to localStorage automatically inside AdvancedFilterBuilder. **This provides seamless UX without app-side logic.**

- **Option C (Compression Strategy):** Define a separate "filter compression" strategy. Complex filters stored via session/localStorage with URL token reference instead of full serialization.

**Architectural recommendation:** Option B. Automatic fallback to localStorage when URL limits are exceeded. This provides seamless UX without requiring app-side URL length validation logic.

---

### Ambiguity 4: Column Definition Contract — Accessor Functions and Data Shape

**Question for stakeholder:**
For the DataTable `columns` prop, what is the **exact contract for column accessors**? Are `accessorFn` required for all columns or only computed columns? Can accessors return `null` or `undefined`? How should empty/null values be rendered?

**Why this matters:**
Developers need to know whether they can pass a simple column key (`accessor: 'email'`) or must always define an accessor function. If nested data is common, accessor patterns must be clear. If `null` values occur, rendering contract must specify fallback (empty string, dash, "—", etc.). Ambiguity here creates type errors and inconsistent empty-state rendering across tables.

**Options:**

- **Option A (Optional for Primitives - RECOMMENDED):** Accessor is optional for primitive columns. If missing, component treats column ID as direct object key (`row[columnId]`). Accessor function required for computed/nested columns. Null/undefined renders as "—". **This balances DX (simple cases are simple) with type safety (computed columns are explicit).**

- **Option B (Always Required):** Accessor is always required (enforced by TypeScript). All columns must define explicit accessor function, even primitives. Null handling configurable per column via `renderNull` prop.

- **Option C (Hybrid):** Accessor optional; if missing, component provides default key accessor. Null rendering configurable globally or per-column.

**Architectural recommendation:** Option A. Optional accessors for primitives (DX), required for computed columns (clarity). Null values render as "—" by default, configurable per-column.

---

### Ambiguity 5: Multi-Language Modal Validation — Per-Language Rules

**Question for stakeholder:**
The specification mentions "Validation per language" but doesn't define the **validation rule contract**. Can different languages have **different validation requirements** (e.g., English required, French optional)? How are validation conflicts resolved? Are **all languages validated before modal closes**, or only required languages?

**Why this matters:**
Validation logic can't be implemented without knowing whether validation is global (all or none) or per-language (selective). If one language can be required while another is optional, the component must expose a `requiredLanguages: string[]` prop. If conflicts exist (e.g., field max-length exceeded in one language), error display logic is unclear. This directly impacts form submission flow and error messaging.

**Options:**

- **Option A (Global Validation):** All enabled languages share the same validation rules. Either all validate successfully or modal rejects submission. Developer configures validation rules once; applied uniformly.

- **Option B (Per-Language Validation - RECOMMENDED):** Per-language validation support. Developer specifies `languageValidations: Record<string, ValidationRules>`. Modal shows errors per language. Submission allowed only if all required languages pass (marked via `requiredLanguages` prop). **This matches realistic translation workflows where certain languages are mandatory.**

- **Option C (Language-Agnostic):** Validation is language-agnostic (structural only: non-empty, length limits). Language-specific business rules handled at app level.

**Architectural recommendation:** Option B. Per-language validation allows apps to mark certain languages as required while others are optional, matching real-world translation workflows.

---

## Remaining Medium-Priority Ambiguities (Can be resolved during Plan step)

| # | Ambiguity | Recommendation |
| --- | --- | --- |
| 1 | Form dirty state definition (touched vs. value change) | Track any interaction; form is dirty if any field was touched |
| 2 | Modal/Drawer size presets (fixed pixels vs. responsive breakpoints) | Responsive breakpoints: sm = 400px, md = 600px, lg = 800px |
| 3 | Empty state precedence (loading vs. no results vs. both) | Loading takes precedence; once loaded, show empty state if no results |

---

## Clarification Summary

| Category | Count |
| --- | --- |
| **Critical ambiguities requiring input** | 5 |
| **Medium-priority (defer to Plan)** | 3 |
| **Non-blocking (defer to implementation)** | 0 |
| **Total** | 8 |

**Risk from unresolved ambiguities:** **HIGH**

Without clarity on these 5 critical decisions, each app (MMC, Backoffice, Frontoffice) will invent its own patterns, leading to:
- Inconsistent component usage across the platform
- Hidden architectural debt in state management
- Difficult refactoring when patterns diverge
- Maintenance burden for UI system evolution

---

## Constitutional Compliance Note

✅ All identified ambiguities are **UI-layer specification only** and do NOT affect:
- Tenant isolation
- License enforcement  
- Attempt engine integrity
- Database schema or transactions
- Snapshot handling
- Version enforcement
- Authentication/authorization
- Multi-tenancy boundaries

**Verdict:** No constitutional violations detected.

---

## Recommended Decisions (Proposed for Stakeholder Approval)

Based on Zidney architecture best practices, the following decisions are proposed for all 5 critical ambiguities:

| Ambiguity | Recommended Decision | Rationale |
| --- | --- | --- |
| 1. Pagination | **Option C (Agnostic)** | Provides flexibility while maintaining control |
| 2. Row Actions | **Option B (Async)** | Handles common case (API calls) natively |
| 3. Filter Serialization | **Option B (Auto Fallback)** | Seamless UX without app-side logic |
| 4. Column Accessors | **Option A (Optional for Primitives)** | Balances DX with type safety |
| 5. Multi-Language Validation | **Option B (Per-Language)** | Matches real-world translation workflows |

---

## Next Step

**Gate Decision:**
- ✅ **Approve recommended decisions:** Proceed immediately to Plan step with proposed resolutions
- ❌ **Override decisions:** Provide alternative options for any of the 5 ambiguities; clarify step will resolve with your input

**Current Status:** Awaiting stakeholder (user) approval on either recommended decisions or alternative options.

---

## Stakeholder Decisions (LOCKED)

**Date:** 2026-02-19  
**Input:** Stakeholder review completed with targeted modifications

### Decision 1: DataTable Pagination Strategy ✅

**Final Position:** APPROVE Option C (Agnostic)

**Stakeholder reasoning:**
- Shared UI system must not enforce backend coupling
- MMC, Backoffice, and future apps may require different strategies
- Server-side pagination required for large datasets
- Client-side useful for small datasets (config tables, local lists)
- Agnostic contract keeps component reusable and future-proof

**Implementation constraint:** None. Option C accepted as specified.

---

### Decision 2: Row Action Callbacks (Async Support) ✅

**Final Position:** APPROVE Option B (Async)

**Stakeholder reasoning:**
- MMC heavily action-driven (activate, archive, upgrade, regenerate, etc.)
- Async UX state management belongs inside component
- Prevents duplicate action triggers
- Improves UX consistency
- Still allows sync via Promise.resolve()

**Implementation constraint:** Async callbacks must emit `@action-start` and `@action-end` events for external UX coordination if needed.

---

### Decision 3: Filter Serialization (URL Overflow) ⚠️

**Final Position:** APPROVE Option B **with modification**

**Stakeholder decision:** URL primary → localStorage fallback **with visible state indicator**

**Modification rationale:**
- Silent fallback creates debugging ambiguity
- Must expose state to prevent confusion when sharing filtered URLs
- Component must emit `onStorageFallback` event or expose `isPersistedExternally` flag

**Implementation requirements:**
1. Component detects URL overflow before serialization
2. If overflow detected, fallback to localStorage automatically
3. Expose `isPersistedExternally` flag via template ref or exposed property
4. Emit `@storage-fallback-triggered` event when overflow occurs
5. Display subtle indicator in UI (e.g., "Filter saved locally" badge)

**Rationale:** Prevents silent failures and helps with debugging persistence issues across page navigation.

---

### Decision 4: Column Accessor Contract ✅

**Final Position:** APPROVE Option A (Optional for Primitives)

**Stakeholder reasoning:**
- Cleanest DX
- Most common case = primitive fields
- Computed/nested requires accessor (correct)
- "—" fallback avoids undefined rendering bugs
- Configurable placeholder supports i18n

**Implementation constraint:** Null/undefined values default to "—" but can be customized per-column via `renderNull` prop.

---

### Decision 5: Multi-Language Modal Validation ✅ + Constraint

**Final Position:** APPROVE Option B **with constraint**

**Stakeholder decision:** Per-language validation enforced with minimum viable language requirement

**Stakeholder reasoning:**
- Per-language validation is correct
- At least one language must always be required
- System must enforce minimum viable language set
- Prevents empty multi-language records
- Avoids null translation artifacts
- Avoids inconsistent CMS state

**Implementation requirement:**
```typescript
/**
 * At least one language must be marked as required
 */
interface MultiLanguageModalProps {
  requiredLanguages: string[] // Must have length >= 1
  // ... other props
}
```

**Validation rule:** Component must throw if `requiredLanguages.length < 1`. This prevents accidentally creating records with zero required translations.

---

## Decision Verification Matrix

| Decision | Option | Approved | Rationale | Constraints |
| --- | --- | --- | --- | --- |
| Pagination | C | ✅ | Flexibility for different backends | None |
| Row Actions | B | ✅ | Async handles common MMC case | Emit start/end events |
| Filter Serialization | B-Mod | ✅ | Auto fallback with visibility | Emit `@storage-fallback-triggered` |
| Column Accessor | A | ✅ | Optimal DX/safety balance | "—" fallback configurable |
| Multi-Language Validation | B | ✅ | Per-language + min 1 required | Enforce `requiredLanguages.length >= 1` |

---

## Next Step

**Clarify step COMPLETE with all decisions locked.**

Proceeding to **Step 3 – Plan**

Plan step will generate technical design artifacts including:
- Component implementation architecture (with all 5 decisions embedded)
- File structure and directory layout detail
- Build system integration strategy
- Testing framework selection
- Migration strategy for existing MMC components

**Estimated Plan complexity:** MEDIUM (some components will have more complex state management due to async row actions and filter fallback logic)

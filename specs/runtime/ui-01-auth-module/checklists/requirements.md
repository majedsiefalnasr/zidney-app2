# Specification Quality Checklist: STAGE_UI_01_AUTH_MODULE

**Purpose**: Validate specification completeness and quality before proceeding to planning  
**Created**: 2026-03-01  
**Feature**: [spec.md](../spec.md)  
**Stage**: STAGE_UI_01_AUTH_MODULE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Validator**: AI Constitutional Review — Zidney Constitution v1.2.0

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) in requirement statements
- [x] Focused on user value and business needs (auth runtime stories capture security and
      correctness value)
- [x] Written for non-technical stakeholders (architectural stories use plain language; Section 4)
- [x] All mandatory sections completed

**Notes**: Section 4 uses "architectural stories" appropriate for a runtime foundation stage. All
mandatory template sections are present. Interface definitions in Section 7 use TypeScript syntax
for precision but are documented as interfaces, not implementation — consistent with precedent in
STAGE_UI_00.

---

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (completion criteria in Section 10 describe
      observable behaviors, not framework internals)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified (failed refresh, concurrent 401s, network errors during refresh,
      logout during pending request, second 401 after retry)
- [x] Scope is clearly bounded (Section 3 in/out-of-scope is explicit)
- [x] Dependencies and assumptions identified (Section 9)

**[NEEDS CLARIFICATION] Markers**: None — all aspects were resolved using reasonable defaults and
constitutional constraints. Decisions made:

| Decision                                       | Resolution Applied                                                                      | Rationale                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Where is `initSession()` called?               | App bootstrap (`main.ts` or root layout `onMounted`) before router navigation unblocked | Prevents login-page flash for already-authenticated users; only reasonable location                        |
| Does `AuthService.logout()` block on response? | No — fire and forget; frontend state cleared unconditionally                            | Network failure must not trap user in logged-in state; aligns with constitution                            |
| AttemptGuard for Frontoffice?                  | Deferred — not in scope for this stage; deferred to Frontoffice Exam Runtime stage      | Guard pipeline for Frontoffice in this stage is auth-only; consistent with STAGE_UI_00 checklist precedent |
| App-specific route names for guards?           | Injected as `AuthGuardOptions` at registration time — not hardcoded in auth module      | Ensures app-agnosticism (FR-27); eliminates branching inside core/auth/                                    |

---

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria (in-store Sections 4 and 10)
- [x] User/architectural scenarios cover all three apps (MMC, Backoffice, Frontoffice — Section 8)
- [x] Feature meets measurable outcomes defined in Completion Criteria (Section 10)
- [x] No implementation details leak into specification (requirements describe WHAT not HOW at
      requirement level)

---

## Architecture Compliance

- [x] Database-per-tenant model preserved (UI stage — no DB access; confirms isolation unaffected)
- [x] No business logic permitted in UI layer (NFR-02, Section 12 Non-Goals, Section 14 Layer
      Separation)
- [x] Token storage strategy is secure (FR-10: memory-only; FR-03: no
      localStorage/sessionStorage/cookie writes)
- [x] No JWT decoding for permissions or authentication state (FR-24, AS-02, Section 2 compliance
      row)
- [x] Token expiry detection via 401 only — no client clock used (NFR-08 area; FR-02 notes; Section
      2 compliance row)
- [x] Workspace slug derived from route only, never from token payload (Section 8.2)
- [x] No cross-app imports declared (Section 14 Layer Separation; each app's core/auth/ is
      self-contained)
- [x] Shared types directed to `packages/types` (Section 9.1 Dependencies)
- [x] License enforcement remains server-side (Section 12, Section 2 compliance table)
- [x] Attempt engine not modified (Section 12, Section 2 compliance table)
- [x] Single-flight refresh prevents amplification under concurrent load (FR-13 to FR-17, AS-03)
- [x] Logout is unconditional — state cleared even if backend call fails (FR-30, FR-35, FR-36,
      FR-37)
- [x] Auth guard uses store state only — no JWT inspection (FR-24)
- [x] Stage status is DRAFT — specification in progress (appropriate for this checkpoint)

---

## Structural Completeness

| Section                                           | Present | Complete |
| ------------------------------------------------- | ------- | -------- |
| 1. Feature Overview                               | ✅      | ✅       |
| 2. Constitutional Compliance Declaration          | ✅      | ✅       |
| 3. Scope Definition (In/Out)                      | ✅      | ✅       |
| 4. Architectural Stories (AS-01 to AS-07)         | ✅      | ✅       |
| 5. Functional Requirements (FR-01 to FR-40)       | ✅      | ✅       |
| 6. Non-Functional Requirements (NFR-01 to NFR-08) | ✅      | ✅       |
| 7. Interface Definitions                          | ✅      | ✅       |
| 8. Per-App Behavior Notes                         | ✅      | ✅       |
| 9. Dependencies (consumed / produced)             | ✅      | ✅       |
| 10. Completion Criteria                           | ✅      | ✅       |
| 11. Test Strategy                                 | ✅      | ✅       |
| 12. Explicit Non-Goals                            | ✅      | ✅       |
| 13. Isolation Impact Analysis                     | ✅      | ✅       |
| 14. Layer Separation Confirmation                 | ✅      | ✅       |
| 15. Final Compliance Statement                    | ✅      | ✅       |

---

## Requirement Coverage Matrix

### Functional Requirements (40 total)

| FR #  | Category                      | Testable | Unambiguous | In Completion Criteria |
| ----- | ----------------------------- | -------- | ----------- | ---------------------- |
| FR-01 | Auth Store                    | ✅       | ✅          | ✅                     |
| FR-02 | Auth Store                    | ✅       | ✅          | ✅                     |
| FR-03 | Auth Store / AuthUser         | ✅       | ✅          | ✅                     |
| FR-04 | Auth Store Actions            | ✅       | ✅          | ✅                     |
| FR-05 | Auth Store Constraints        | ✅       | ✅          | ✅                     |
| FR-06 | Auth Store Constraints        | ✅       | ✅          | ✅                     |
| FR-07 | Token Exposure Prevention     | ✅       | ✅          | ✅                     |
| FR-08 | Token Manager                 | ✅       | ✅          | ✅                     |
| FR-09 | Token Manager Interface       | ✅       | ✅          | ✅                     |
| FR-10 | Token Storage Security        | ✅       | ✅          | ✅                     |
| FR-11 | Token Log Prevention          | ✅       | ✅          | ✅                     |
| FR-12 | Token Non-Persistence         | ✅       | ✅          | ✅                     |
| FR-13 | Refresh Manager               | ✅       | ✅          | ✅                     |
| FR-14 | Refresh Manager Behavior      | ✅       | ✅          | ✅                     |
| FR-15 | Refresh Request Mechanics     | ✅       | ✅          | ✅                     |
| FR-16 | No Retry Loop                 | ✅       | ✅          | ✅                     |
| FR-17 | Refresh Manager Interface     | ✅       | ✅          | ✅                     |
| FR-18 | API Client Token Attachment   | ✅       | ✅          | ✅                     |
| FR-19 | API Client 401 Handling       | ✅       | ✅          | ✅                     |
| FR-20 | Single Retry Limit            | ✅       | ✅          | ✅                     |
| FR-21 | Token Log Prevention (client) | ✅       | ✅          | ✅                     |
| FR-22 | Guard Registration            | ✅       | ✅          | ✅                     |
| FR-23 | Guard Logic Table             | ✅       | ✅          | ✅                     |
| FR-24 | Guard Uses Store Only         | ✅       | ✅          | ✅                     |
| FR-25 | Guard Return Pattern          | ✅       | ✅          | ✅                     |
| FR-26 | Guard No Exceptions           | ✅       | ✅          | ✅                     |
| FR-27 | Guard Configurable Names      | ✅       | ✅          | ✅                     |
| FR-28 | AuthService Interface         | ✅       | ✅          | ✅                     |
| FR-29 | AuthService Uses Client       | ✅       | ✅          | ✅                     |
| FR-30 | Logout Resolves Always        | ✅       | ✅          | ✅                     |
| FR-31 | AuthService Typed Returns     | ✅       | ✅          | ✅                     |
| FR-32 | Session Init Bootstrap        | ✅       | ✅          | ✅                     |
| FR-33 | initSession Behavior          | ✅       | ✅          | ✅                     |
| FR-34 | initSession Blocks Guards     | ✅       | ✅          | ✅                     |
| FR-35 | Logout Sequence               | ✅       | ✅          | ✅                     |
| FR-36 | Logout Idempotency            | ✅       | ✅          | ✅                     |
| FR-37 | Logout State Reset            | ✅       | ✅          | ✅                     |
| FR-38 | Error Contract                | ✅       | ✅          | ✅                     |
| FR-39 | Auth Error Codes              | ✅       | ✅          | ✅                     |
| FR-40 | Error Log Safety              | ✅       | ✅          | ✅                     |

### Non-Functional Requirements (8 total)

| NFR #  | Category          | Verifiable |
| ------ | ----------------- | ---------- |
| NFR-01 | TypeScript Strict | ✅         |
| NFR-02 | App Agnosticism   | ✅         |
| NFR-03 | Token Exposure    | ✅         |
| NFR-04 | Concurrency       | ✅         |
| NFR-05 | No UI Flash       | ✅         |
| NFR-06 | Testability       | ✅         |
| NFR-07 | Lint/Type Pass    | ✅         |
| NFR-08 | No Token Logging  | ✅         |

---

## Security Validation

| Security Rule                                      | Covered By                  | Status |
| -------------------------------------------------- | --------------------------- | ------ |
| Access token in memory only                        | FR-10, NFR-03               | ✅     |
| No token in localStorage / sessionStorage          | FR-10, NFR-03               | ✅     |
| No token in URL or query params                    | NFR-03                      | ✅     |
| No token logged                                    | FR-11, FR-21, FR-40, NFR-08 | ✅     |
| No JWT decoding for permissions                    | FR-24, Section 2            | ✅     |
| No client-time token expiry checking               | Section 2, AS-02            | ✅     |
| Refresh token never touched by JavaScript          | FR-15, AS-01                | ✅     |
| Logout clears all state unconditionally            | FR-30, FR-35-37             | ✅     |
| Single-flight refresh prevents token amplification | FR-13-17, AS-03             | ✅     |
| No password validation in frontend                 | Section 2, Section 12       | ✅     |
| No token issuance in frontend                      | Section 2, Section 12       | ✅     |

---

## Test Coverage Validation

| Test Type         | Required | Addressed In Spec | Test Cases Defined |
| ----------------- | -------- | ----------------- | ------------------ |
| Unit tests        | ✅       | Section 11.1      | ✅ (5 subjects)    |
| Integration tests | ✅       | Section 11.2      | ✅ (6 scenarios)   |
| Concurrency tests | ✅       | Section 11.2      | ✅                 |
| Snapshot tests    | N/A      | Section 11.3      | Not required       |
| Isolation tests   | ✅       | Sections 13-14    | ✅                 |

---

## Notes

All checklist items pass. No items require spec updates before proceeding to `/speckit.plan`.

Key decisions documented above in the [NEEDS CLARIFICATION] resolution table. No ambiguity remains.

The spec is ready for the planning phase.

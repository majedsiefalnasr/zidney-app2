# Clarify Report — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Step:** 2 — Clarify
**Timestamp:** 2026-02-28T00:20:00Z
**Status:** COMPLETE

---

## Summary

5 clarification questions scanned and resolved during the ambiguity audit. All resolutions applied via best-practice defaults — no user input required. The single `[NEEDS CLARIFICATION]` marker from Step 1 was resolved and removed. The MMC migration delta table was expanded to include explicit per-file mappings for all 23 files found in the actual MMC `src/`. Spec is ready for planning.

---

## Inputs Reviewed

- `specs/runtime/ui-00-runtime-architecture/spec.md` (including `### Session 2026-02-28`)

---

## Clarifications Resolved

| #   | Question                                                             | Resolution                                                                                                                           | Impact                                                                     |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1   | Should Frontoffice implement `AttemptGuard` now?                     | **Deferred to Exam Runtime stage.** All apps: guard pipeline = `auth.guard → role.guard` only. `workspace.guard.ts` Backoffice-only. | Guard pipeline simplified; no blocker.                                     |
| 2   | Refresh failure path — behavior when token refresh itself fails?     | **Queued requests rejected** with `AUTH_REFRESH_FAILED` (httpStatus: 401), auth store cleared, redirect to login.                    | New sub-requirement for FR-06; API client behavior is now fully specified. |
| 3   | NormalizedError — should it include `fieldErrors` for 422 responses? | **Sealed at 3 fields** — `code`, `message`, `httpStatus`. `fieldErrors` deferred to auth/form-validation stage.                      | Error shape locked; prevents scope creep.                                  |
| 4   | Network error retry — automatic backoff at scaffolding level?        | **No automatic retry.** Network errors surface as `NETWORK_ERROR` (httpStatus: 0). Retry is opt-in per feature in later stages.      | API client stays minimal; testable.                                        |
| 5   | MMC delta — does the delta table cover all 23 component files?       | **Expanded** to explicit per-file/per-folder mappings for all files found in actual `apps/mmc/src/`.                                 | Migration tasks are now precise; no ambiguity in implementation.           |

---

## Open Items

None — 0 unresolved markers remaining.

---

## Spec Updates Applied

- Removed `[NEEDS CLARIFICATION]` marker from §8.3 (Frontoffice guard pipeline — AttemptGuard deferred)
- §5.2 FR-06: Sub-requirement added — refresh failure path defined (`AUTH_REFRESH_FAILED`, store clear, login redirect)
- §5.6 FR-26: `NormalizedError` sealed at 3 fields; `fieldErrors` deferral noted
- §5.6 FR-28: Network error handling clarified — no retry, `NETWORK_ERROR` code, httpStatus: 0
- §8.1 MMC Delta: Table expanded from generic rule to explicit per-file/per-folder mappings for full `apps/mmc/src/` inventory
- `### Session 2026-02-28` appended to spec.md

---

## Constitutional Compliance

| Check                                     | Status  | Notes                                                                     |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅ PASS | 0 open markers                                                            |
| Transaction strategy confirmed            | ✅ N/A  | UI stage — no backend transactions                                        |
| Idempotency strategy confirmed            | ✅ N/A  | No write endpoints in this stage                                          |
| Isolation boundaries confirmed            | ✅ PASS | `workspace_slug` from router params only; workspace.guard Backoffice-only |
| Version and license constraints confirmed | ✅ N/A  | Enforcement is server-side only                                           |
| Token security model confirmed            | ✅ PASS | Memory-only access token; httpOnly cookie; no localStorage                |
| Error contract sealed                     | ✅ PASS | NormalizedError locked at 3 fields                                        |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                                                                         | Severity | Mitigation                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| MMC migration delta must be executed with care — existing import paths may reference non-canonical locations | MEDIUM   | Delta table is now explicit; implementation tasks will include an import audit step before moving files |

---

## Next Step

Proceed to **Step 3 — Plan**.

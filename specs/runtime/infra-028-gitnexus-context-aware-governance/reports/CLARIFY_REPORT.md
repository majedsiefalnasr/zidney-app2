# Clarify Report — GitNexus Context-Aware Governance

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-25T00:10:00Z  
**Status:** COMPLETE

---

## Summary

All specification ambiguities resolved in a single clarification session.
5 targeted questions were asked and answered from existing codebase evidence
(`gitnexus-context.ts`, `docs/ai/gitnexus-context.schema.json`, `package.json`,
`.husky/pre-commit`). No `[NEEDS CLARIFICATION]` markers remain.
**Risk Level: LOW (score 1)** — pure tooling stage with no DB, tenant, auth, or worker changes.

---

## Inputs Reviewed

- `specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md` (including `## Clarifications`)
- `scripts/gitnexus-context.ts` — verified exports: `assembleContext`, `AssembleOptions`, helpers
- `docs/ai/gitnexus-context.schema.json` — verified `required` array and `version` field
- `package.json` — verified existing `arch:gitnexus:context` points to `gitnexus-context.ts`
- `.husky/pre-commit` — verified hook execution model for sequential calls
- `.github/workflows/architecture-governance.yml` — verified CI step structure

---

## Clarifications Resolved

| #   | Question                                                                                                     | Resolution                                                                                                                                                                                                                                                                                                                                                                     | Impact                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Q1  | How does `context:changed` differ from `arch:guard:changed`? Is double-invocation in pre-commit intentional? | They serve different roles. `arch:guard:changed` runs opaque scoped validation using its own internal `git diff --cached`. `context:changed` is a **shared context resolver** that caches the resolved changed-file set into `gitnexus-context.json` (<5min freshness) for all downstream consumers. Double call is intentional — the second call is a near-instant cache hit. | FR-003 item 1 is now authoritative: <5min = cache hit. No redundant git subprocess across gate. |
| Q2  | Exact output schema for `context:impact --json`?                                                             | `RiskIndicator[]` matching `{ module: string; riskScore: number; reason: string; affectedBy: string[] }` from `gitnexus-context.ts`. BFS fields: `riskScore = BFS traversal depth`, `reason = "transitively affected via <direct_module>"`, `affectedBy = root changed file paths`. Without `--json`, one module path per line (stable-sorted).                                | FR-004 item 4 is the canonical contract.                                                        |
| Q3  | How does `context:validate` resolve its field list and schema version — hardcoded or from schema file?       | `docs/ai/gitnexus-context.schema.json` EXISTS and MUST be authoritative. `context:validate` reads `required` array for fields and top-level `version` field (`"1.0.0"`) as expected `schemaVersion`. No external JSON Schema lib — plain key enumeration. `SCHEMA_VERSION` is a `const` (not exported) in `gitnexus-context.ts`.                                               | NFR-005 (no new deps) preserved. Schema file is the single source of truth.                     |
| Q4  | Can `context:build` use Strategy (1) direct import from `gitnexus-context.ts`?                               | YES — confirmed. `gitnexus-context.ts` exports `assembleContext(options: AssembleOptions): GitNexusContext` at line 318. `context:build` uses `import { assembleContext, AssembleOptions } from '../gitnexus-context.ts'`. Strategy (2) risk in spec is now resolved.                                                                                                          | `context:build` is the canonical thin wrapper over `assembleContext()`.                         |
| Q5  | Is `context:build` a replacement for, alias of, or independent wrapper over `arch:gitnexus:context`?         | **Independent superset wrapper.** `arch:gitnexus:context` continues pointing directly to `scripts/gitnexus-context.ts` unchanged — both coexist. `governance:gate` and `governance:gate:changed` use `context:build` exclusively going forward.                                                                                                                                | Backward-compatibility preserved. Zero migration required.                                      |

---

## Open Items

None.

---

## Spec Updates Applied

- `## Clarifications` section appended at end of `spec.md` (line 492+)
- Session `2026-03-25` with 5 Q&As recorded
- `## Risk Level` section added with scoring table (Score: 1 — LOW)
- Strategy (2) fallback risk in Risk Assessment table resolved: "Resolved / Strategy 1 confirmed"
- Assumption 1 closed: Strategy (1) is the confirmed implementation path

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                                        |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 Q&As resolved; zero `[NEEDS CLARIFICATION]` markers                                      |
| Transaction strategy confirmed            | ✅     | N/A — no DB changes in this stage                                                            |
| Idempotency strategy confirmed            | ✅     | `context:build` uses atomic write (tmp+rename); `context:changed` uses <5min cache freshness |
| Isolation boundaries confirmed            | ✅     | N/A — no tenant logic; workspace-level tooling only                                          |
| Version and license constraints confirmed | ✅     | NFR-005 enforces no new dependencies; existing imports only                                  |

**Overall:** COMPLIANT

---

## Open Risks

- **CHK021** (checklist gap): spec silent on whether `context:validate` also runs in pre-commit (currently only `context:changed` is specified for pre-commit via FR-010). Plan phase should confirm whether validation belongs in pre-commit or only in CI gate.
- **CHK058** (checklist gap): TypeScript strict mode is implied but not explicitly stated as an NFR. Plan should validate that all 4 scripts pass `tsc --strict`.

Both gaps are low-severity and do not block planning.

---

## Risk Level

**Score: 1 — LOW**

| Factor                   | Points | Rationale                                                                                |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| New table/column         | +0     | Pure tooling stage — no DB changes                                                       |
| Security-sensitive logic | +0     | Shell injection reuses existing `validateCliArg` pattern                                 |
| Worker interaction       | +0     | No worker jobs                                                                           |
| Multi-tenant isolation   | +0     | No tenant logic                                                                          |
| External API             | +0     | No external HTTP calls                                                                   |
| More than 10 tasks       | +1     | ~12 deliverables: 4 scripts + 4 registrations + gate.ts + gate:changed + pre-commit + CI |
| More than 20 tasks       | +0     | Total < 20                                                                               |
| New package dependency   | +0     | NFR-005 forbids new dependencies                                                         |
| **Total**                | **1**  | **LOW**                                                                                  |

---

## Next Step

Proceed to Step 3 — Plan.

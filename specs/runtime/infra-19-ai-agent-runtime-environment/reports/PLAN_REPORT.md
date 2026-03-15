# Plan Report — STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT

**Step:** 3 — Plan
**Timestamp:** 2026-03-15T00:03:00.000Z
**Status:** COMPLETE

---

## Summary

Technical plan complete for the AI Agent Runtime Environment stage. This is an additive-only developer tooling stage requiring 3 new files, 2 modified files, and zero architectural module changes. The plan covers the full implementation of `scripts/ai-runtime/runtime-status.ts` (9 diagnostic checks across 5 runtime layers), 3 `package.json` script registrations, CI integration in the `arch-guard` job, and unit + integration test scaffolding.

Guardian validation: Architecture Checker = **PASS** (all 6 checks clean). API Designer = **N/A** (no HTTP routes introduced).

---

## Inputs Reviewed

- `specs/runtime/infra-19-ai-agent-runtime-environment/spec.md`
- `specs/runtime/infra-19-ai-agent-runtime-environment/plan.md`
- `specs/runtime/infra-19-ai-agent-runtime-environment/research.md`
- `package.json` (existing scripts — confirmed `ai-context:refresh`, `arch:validate-brain` exist)
- `.github/workflows/ci.yml` (arch-guard job structure)
- `scripts/ai-guard.ts`, `scripts/generate-ai-context.ts` (implementation patterns)
- `docs/ai/context/` (all 9 AI context artifacts confirmed present)

---

## Architecture Layers Touched

| Layer                                 | Planned Changes                                        |
| ------------------------------------- | ------------------------------------------------------ |
| API                                   | None                                                   |
| Worker                                | None                                                   |
| Frontend (backoffice/frontoffice/mmc) | None                                                   |
| DB Master                             | None                                                   |
| DB Tenant                             | None                                                   |
| scripts/ (tooling)                    | +1 new file: `scripts/ai-runtime/runtime-status.ts`    |
| CI                                    | +1 step in `.github/workflows/ci.yml` `arch-guard` job |
| package.json                          | +3 script entries                                      |
| tests/                                | +2 new test files                                      |

---

## Key Technical Decisions

| #   | Decision                                                                                                         | Rationale                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Use `existsSync` + `statSync` + `readFileSync` (node:fs) only                                                    | No external deps; Bun-compatible; matches existing script pattern      |
| 2   | Try/catch per check (not fail-fast)                                                                              | Developer needs full picture of runtime health, not just first failure |
| 3   | Exit 0 = pass/warn; Exit 1 = any error-level check                                                               | Enables CI blocking without degrading developer DX on warnings         |
| 4   | Freshness threshold via `AI_CONTEXT_MAX_AGE_HOURS` env var (default: 24h)                                        | Configurable without code change; CI can override                      |
| 5   | CI step added within existing `arch-guard` job, after `module-boundary-validation`                               | Reuses existing job cache setup; zero new job overhead                 |
| 6   | `ai-runtime:refresh` delegates to `ai-context:refresh`; `ai-runtime:validate` delegates to `arch:validate-brain` | Reuse; no duplication; single source of truth for these operations     |
| 7   | Test structure mirrors `tests/unit/infra-audit/` pattern                                                         | Consistency; no new test framework needed                              |

---

## Migration Impact

| Item                  | Value | Notes                                             |
| --------------------- | ----- | ------------------------------------------------- |
| Migration required    | No    | Developer tooling only — no DB schema changes     |
| `schema_version` bump | No    | N/A                                               |
| Backward compatible   | Yes   | Additive-only — no existing functionality removed |

---

## Transaction Boundaries

Not applicable — read-only diagnostic script. No write operations.

---

## API Contract Changes

Not applicable — no HTTP endpoints introduced.

---

## Idempotency Strategy

Fully idempotent by nature — the script only reads file system state and produces output.

---

## Files Affected

### New Files

| File                                                              | Purpose                                           |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| `scripts/ai-runtime/runtime-status.ts`                            | AI runtime diagnostics — 9 checks across 5 layers |
| `tests/unit/ai-runtime/runtime-status.test.ts`                    | Unit tests (mocked fs) for all 5 check functions  |
| `tests/integration/ai-runtime/runtime-status.integration.test.ts` | Integration tests (real fs)                       |

### Modified Files

| File                       | Change                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| `package.json`             | +3 scripts: `ai-runtime:status`, `ai-runtime:refresh`, `ai-runtime:validate` |
| `.github/workflows/ci.yml` | +1 step in `arch-guard` job after `module-boundary-validation`               |

---

## Risk Assessment

**Overall Risk Level: LOW**

| Risk                                       | Probability | Impact     | Mitigation                                                             |
| ------------------------------------------ | ----------- | ---------- | ---------------------------------------------------------------------- |
| AI context artifacts renamed in future     | Low         | Low        | Spec locks exact filenames; updating the check list is a 1-line change |
| CI step adds latency                       | Low         | Negligible | Script runs in < 1s (file existence checks only)                       |
| `arch:validate-brain` script doesn't exist | Very Low    | Low        | Confirmed present in package.json during research                      |

---

## Implementation Order

1. T001 — Create `scripts/ai-runtime/` directory
2. T002 — Implement `scripts/ai-runtime/runtime-status.ts` (5 check functions + main runner)
3. T003 — Register 3 scripts in `package.json`
4. T004 — Add CI step to `.github/workflows/ci.yml`
5. T005 — Write unit tests in `tests/unit/ai-runtime/`
6. T006 — Write integration tests in `tests/integration/ai-runtime/`
7. T007 — Validate: `bun ai-runtime:status`, `bun run lint`, `bun run type-check`

---

## Guardian Audit Results

| Guardian                    | Verdict       | Notes                                             |
| --------------------------- | ------------- | ------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS       | All 6 checks clean; no module registration needed |
| Zidney API Designer         | ✅ PASS (N/A) | No HTTP routes — not applicable                   |

---

## Next Step

Proceeding to Step 4 — Tasks.

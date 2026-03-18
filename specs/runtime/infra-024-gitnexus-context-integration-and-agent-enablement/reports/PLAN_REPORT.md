# Plan Report — GitNexus Context Integration and Agent Enablement

**Step:** 3 — Plan  
**Timestamp:** 2026-03-18T14:00:00+03:00  
**Status:** COMPLETE

---

## Summary

Technical plan for INFRA-024 is complete. The stage replaces `scripts/gitnexus-context.ts` with a fully structured JSON context producer, adds `scripts/validate/validate-gitnexus.ts` for schema validation, introduces a formal JSON output contract (`docs/ai/gitnexus-context.schema.json`), and integrates GitNexus context awareness into the Zidney Orchestrator and AGENTS.md governance policy.

The plan was produced by `speckit.plan`, validated by guardians (Architecture Checker: PASS; API Designer: initially BLOCKED, remediated and re-validated to PASS), and is now ready for task generation.

**Guardian remediation summary (3 BLOCK issues resolved before commit):**

1. `additionalProperties: false` at schema root → removed; root-level extensibility preserved
2. Missing `analysisMode` field → added as required `"changed-only" | "full"` root field
3. `riskScore` type mismatch (TS `number` vs JSON Schema `integer`) → aligned to `number` with integer-only convention documented

---

## Inputs Reviewed

- `specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/spec.md`
- `specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/plan.md`
- `specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/research.md`
- `specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/data-model.md`

---

## Architecture Layers Touched

| Layer      | Planned Changes                                                                             |
| ---------- | ------------------------------------------------------------------------------------------- |
| API        | None — no HTTP routes added or modified                                                     |
| Worker     | None — Worker not touched                                                                   |
| Frontend   | None — no UI code                                                                           |
| DB Master  | None — no master schema changes                                                             |
| DB Tenant  | None — no tenant schema changes                                                             |
| Scripts    | `scripts/gitnexus-context.ts` full replacement; `scripts/validate/validate-gitnexus.ts` new |
| Docs       | `docs/ai/gitnexus-context.schema.json`, `docs/ai/gitnexus.md`, `docs/scripts/` (x2)         |
| Governance | `AGENTS.md` (additive), `.agents/agents/zidney-orchestrator.agent.md` (additive)            |
| Config     | `package.json` — adds `gitnexus:context` and `gitnexus:validate` script entries             |

---

## Key Technical Decisions

| #   | Decision                                                              | Rationale                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Full replacement of `scripts/gitnexus-context.ts`                     | Legacy script printed human-readable text from brain.json. New script produces machine-readable JSON for AI agent consumption. Confirmed in Clarification Q1.                               |
| 2   | Git commands + brain.json for structured data (not GitNexus CLI JSON) | GitNexus exposes intelligence via MCP tools, not raw JSON CLI. Local context generation combines `git diff`/`git log` with `ai-architecture-brain.json`. Confirmed via Context7 MCP lookup. |
| 3   | `analysisMode: "changed-only"                                         | "full"` as required field                                                                                                                                                                   | Enables AI agents to know whether `dependencyGraph` covers only impacted modules (default) or the full workspace (`--all` flag). Prevents ambiguous reasoning about graph scope. |
| 4   | `additionalProperties` omitted from root schema                       | Prevents breaking changes when new fields are added in future schema versions. Sub-object items use their own constraints.                                                                  |
| 5   | `riskScore: number` (not integer) in TypeScript                       | TypeScript has no integer type. Convention of integer-only values (0–100) is documented in schema and validation rules without sacrificing type safety.                                     |
| 6   | `scripts/validate/validate-gitnexus.ts` location                      | Follows `scripts/<domain>/` subdirectory convention per AGENTS.md script governance rules. Script key: `gitnexus:validate`.                                                                 |
| 7   | Script exports testable pure functions                                | `assembleContext()`, `detectChangedFiles()`, etc. are exported from the script, enabling Vitest unit tests without subprocess invocation.                                                   |
| 8   | Output file path: `docs/ai/context/gitnexus-context.json`             | Confirmed in Clarification Q4. Consistent with other AI context artifacts in the same directory.                                                                                            |
| 9   | Empty arrays are a valid CI PASS state                                | `changedFiles: []` on a clean working tree is schema-valid. CI fails only on non-zero exit, schema violation, or script error. Confirmed in Clarification Q5.                               |

---

## Migration Impact

| Item                  | Value | Notes                                                      |
| --------------------- | ----- | ---------------------------------------------------------- |
| Migration required    | No    | Infrastructure tooling only                                |
| `schema_version` bump | No    | No database schema changes                                 |
| Backward compatible   | Yes   | Existing `arch:context` / `arch:refresh` scripts unchanged |

---

## Transaction Boundaries

- None required — no database writes anywhere in this stage.

---

## Idempotency Strategy

- Script is inherently idempotent. Each invocation regenerates `gitnexus-context.json` from current git state. Re-running produces identical output on identical inputs.
- Output file is always overwrite (not append). Stale runs are safe.

---

## Output JSON Schema Summary

**Schema Version:** 1.0.0  
**File:** `docs/ai/gitnexus-context.schema.json`  
**Output location:** `docs/ai/context/gitnexus-context.json`

Required root fields (9):
| Field | Type | Notes |
| -------------------- | --------------------------- | ------------------------------------------------------ |
| `schemaVersion` | `string` | Always `"1.0.0"` for this release |
| `generatedAt` | `string` (ISO 8601) | Generation timestamp |
| `analysisMode` | `"changed-only" \| "full"` | Scope indicator for `dependencyGraph` |
| `changedFiles` | `string[]` | Relative paths, may be empty |
| `impactedModules` | `string[]` | `apps/*` or `packages/*` paths, may be empty |
| `dependencyGraph` | `Record<string, string[]>` | Module import graph (scoped or full per `analysisMode`) |
| `architectureLayerMap` | `Record<string, string>` | Module → layer name mapping |
| `recentCommits` | `RecentCommit[]` | Last 10 commits, may be empty |
| `riskIndicators` | `RiskIndicator[]` | Risk metadata per impacted module, may be empty |

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                  |
| --------------------------------------- | ------ | ------------------------------------------------------ |
| No cross-tenant logic introduced        | ✅     | No tenant DB or tenant resolver accessed               |
| All writes are transactional by design  | ✅ N/A | No database writes                                     |
| Server-authoritative time enforced      | ✅ N/A | No time-sensitive runtime logic                        |
| License middleware enforced             | ✅ N/A | No API routes                                          |
| Version compatibility enforced          | ✅ N/A | Script versioning managed by schema_version            |
| No architecture redesign without ADR    | ✅     | Plan is fully additive; no structural changes          |
| Script governance (`<domain>:<action>`) | ✅     | `gitnexus:context`, `gitnexus:validate`                |
| Script documentation in `docs/scripts/` | ✅     | Both scripts have planned doc files (Phase 7)          |
| JSDoc metadata headers                  | ✅     | All scripts will include required JSDoc fields         |
| No `console.log`                        | ✅     | Only `process.stdout.write` (JSON) and `console.error` |
| Import boundary rules                   | ✅     | Scripts import only from `node:*` and local files      |

**Overall:** COMPLIANT

---

## Open Risks

| Risk ID  | Description                                  | Mitigation                                                       |
| -------- | -------------------------------------------- | ---------------------------------------------------------------- |
| RISK-001 | GitNexus produces incorrect context          | Schema validation in `gitnexus:validate` + 5 deterministic tests |
| RISK-002 | `ai-architecture-brain.json` not present     | Script exits with actionable error: `"Run: bun run arch:audit"`  |
| RISK-003 | Git commands fail in CI (shallow clone)      | Fallback from `HEAD~1` to `git status --porcelain` on error      |
| RISK-004 | Schema drift between wrapper and schema file | `gitnexus:validate` runs schema check in CI                      |

---

## Guardian Verdicts

| Guardian                    | Verdict | Notes                                                              |
| --------------------------- | ------- | ------------------------------------------------------------------ |
| Zidney Architecture Checker | ✅ PASS | Pre-implementation fixes applied (script naming, hash/date fields) |
| Zidney API Designer         | ✅ PASS | 3 blocking issues remediated before commit (see Summary above)     |

---

## Next Step

Proceed to Step 4 — Tasks.

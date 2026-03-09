# Specify Report — STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION

**Step:** 1 — Specify
**Timestamp:** 2026-03-09T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification generated for the Architecture Visualization stage. This is a pure infrastructure tooling stage that introduces a standalone `scripts/architecture/visualize.ts` script to convert raw audit output into curated, human-readable Mermaid diagrams stored in `docs/architecture/visualization/`. No database access, no tenant logic, no runtime changes — purely a developer tooling and documentation layer.

The spec is comprehensive (12 FRs, 3 developer scenarios, 6 acceptance scenarios, 12 unit tests, 8 measurable success criteria). All `[NEEDS CLARIFICATION]` markers have been resolved. Checklist at `checklists/requirements.md` shows all items passing.

---

## Inputs Reviewed

- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION.md`
- `specs/templates/specify-template.md`
- `docs/architecture/ZIDNEY_ARCHITECTURE_SYSTEM.md`
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json`
- `docs/architecture/graphs/` (existing audit output)
- `scripts/infra-audit.ts` (data source for visualization)
- Dependent stage outputs: infra-007, infra-006

---

## Key Decisions

| #   | Decision                                                                                 | Rationale                                                                                                         |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Mermaid `.mmd` format only (no SVG/PNG)                                                  | Markdown-compatible, GitHub-native, no external CLI needed, readable as plain text                                |
| 2   | Script named `arch:visualize`                                                            | Follows existing `arch:` family convention (`arch:audit`, `arch:guard`, etc.)                                     |
| 3   | Output to `docs/architecture/visualization/` (separate from `docs/architecture/graphs/`) | `graphs/` is raw machine output; `visualization/` is curated human-readable output — clear separation of concerns |
| 4   | `ARCHITECTURE_MAP.json` is optional with heuristic fallback                              | Visualization must not block developers who haven't run `arch:audit --fix-map`                                    |
| 5   | System overview diagram is static (trust-chain topology)                                 | Trust chain is architectural, not dynamically derived from import graphs                                          |
| 6   | No modifications to `infra-audit.ts`                                                     | Preserves stability of existing governance pipeline; visualization is additive only                               |

---

## Functional Requirements Captured

- FR-001: Create `scripts/architecture/visualize.ts` as executable entry point
- FR-002: Accept `--output-dir` CLI flag (default: `docs/architecture/visualization/`)
- FR-003: Read primary input from `docs/architecture/graphs/dependency-graph.json`; exit 1 with clear message if missing
- FR-004: Generate `module-dependency-graph.mmd` — top-level modules only, deduplicated edges, layer-annotated nodes
- FR-005: Generate `layer-architecture-diagram.mmd` — four subgraph blocks, modules grouped by layer, inter-layer edges
- FR-006: Generate `system-overview-diagram.mmd` — static trust-chain topology (MMC/Backoffice/Frontoffice → API → Worker → domain-core)
- FR-007: Read secondary input from `docs/architecture/intelligence/ARCHITECTURE_MAP.json`; warn and apply heuristic fallback if missing
- FR-008: Generate `docs/architecture/visualization/README.md` with diagram index, generation timestamp, and render instructions
- FR-009: Create output directory if it does not exist (no pre-condition required)
- FR-010: Exit code 0 on success, exit code 1 on fatal error (missing primary input or unrecoverable parse error)
- FR-011: Add `arch:visualize` script entry to root `package.json`
- FR-012: No new external npm dependencies — use Bun built-ins and Node built-ins only

---

## Clarifications Required

None — all specification ambiguities resolved during authoring.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                       |
| --------------------------------------- | ------ | --------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Pure CLI tooling, no database or tenant context                             |
| License middleware requirement captured | ✅ N/A | No API routes or runtime middleware                                         |
| Snapshot integrity requirement captured | ✅ N/A | Not applicable                                                              |
| Idempotency strategy defined            | ✅     | Script always overwrites outputs — idempotent by design                     |
| Transaction boundaries identified       | ✅ N/A | No database writes                                                          |
| Server-authoritative time enforced      | ✅ N/A | Generation timestamp from `Date.now()` is fine for a documentation artifact |

**Overall:** COMPLIANT — This is a pure developer tooling stage with no runtime or tenant impact.

---

## Open Risks

- `dependency-graph.json` schema could change if `infra-audit.ts` is updated without notice → mitigated by defensive JSON parsing with clear error messages
- ARCHITECTURE_MAP.json heuristic fallback may misclassify new module types → acceptable risk; fallback produces usable (not perfect) output

---

## Next Step

Proceed to Step 2 — Clarify.

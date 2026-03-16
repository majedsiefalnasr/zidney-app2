# Clarify Report — Runtime Script Recovery and Validation

**Step:** 2 — Clarify
**Timestamp:** 2026-03-17T00:02:00.000Z
**Status:** COMPLETE

---

## Summary

Clarification session resolved 5 key ambiguities covering scan patterns, broken-script detection,
environment requirements, canonical selection, and CI guard behavior. All clarifications are locked
with concrete decisions. Planning is unblocked.

---

## Inputs Reviewed

- `specs/runtime/fix-01-runtime-script-recovery-and-validation/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                         | Resolution                                                                                                                                   | Impact                    |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Which script names does T001 scan for?           | Regex `bun run ([a-zA-Z][a-zA-Z0-9:_-]*)` over all markdown text                                                                             | Clear scan scope          |
| 2   | How are "broken" scripts detected?               | Static-only: `bun build --dry-run` / `tsc --noEmit`; missing file = missing; type/import failure = broken; infra-dep = valid/infra-dependent | Clear T003 classification |
| 3   | Can T007 validation run without live infra?      | Yes — no live DB/Redis required; exit 0 OR structured-log non-zero = pass; crash = fail                                                      | Safe CI execution         |
| 4   | How is canonical implementation selected (T004)? | Superset wins → apps/api baseline → alphabetical; always merge-then-remove                                                                   | No silent data loss       |
| 5   | Does T011 hard-block or warn?                    | Hard-block (exit 1) always; "Recommended" = optional CI YAML integration only                                                                | CI guard is reliable      |

---

## Open Items

None — all clarifications resolved.

---

## Spec Updates Applied

- Appended `## Clarifications / ### Session 2026-03-17` section to `spec.md`
- Scan regex locked: `bun run ([a-zA-Z][a-zA-Z0-9:_-]*)`
- Broken detection method locked: static analysis only
- T007 env policy locked: no live infra required
- T004 canonical selection algorithm locked: superset-merge with apps/api precedence
- T011 guard behavior locked: always `exit 1`

---

## Constitutional Compliance

| Check                                     | Status | Notes                                         |
| ----------------------------------------- | ------ | --------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions answered, no open markers       |
| Transaction strategy confirmed            | ✅     | N/A — no DB writes in scope                   |
| Idempotency strategy confirmed            | ✅     | Script reconstruction is idempotent by design |
| Isolation boundaries confirmed            | ✅     | N/A — infrastructure tooling only             |
| Version and license constraints confirmed | ✅     | N/A — no request handling                     |

**Overall:** COMPLIANT

---

## Open Risks

None identified.

# Tasks: Policy Engine Bootstrap Minimal

## Stage

fix-02-policy-engine-bootstrap-minimal

## Phase

0X_FIXES

---

- [x] T001 Create `scripts/policy-engine/` directory — ensure `scripts/policy-engine/` exists in the repository root
- [x] T002 Create `scripts/policy-engine/types.ts` with exact interface content: `PolicyContext`, `PolicyResult`, `PolicyRule`
- [x] T003 Create `scripts/policy-engine/registry.ts` with exact content: import `PolicyRule`, define `dummyRule`, export `rules: PolicyRule[]`
- [x] T004 Create `scripts/policy-engine/runner.ts` — parse `--changed` flag, sequential `for...of` rule execution, per-rule `[PASS]`/`[FAIL]` output, exit `1` on any `error`-severity failure, exit `0` otherwise
- [x] T005 Update root `package.json` — add `"policy:check": "bun run scripts/policy-engine/runner.ts"` to the `scripts` section (additive only, no other changes)
- [x] T006 Verify `bun run policy:check` executes successfully — confirm exit `0` and `"Policy check passed"` in stdout; also run `bun run policy:check --changed` and confirm exit `0`
- [x] T007 Verify empty registry exits `0` — temporarily remove the dummy rule from `scripts/policy-engine/registry.ts`, run `bun run policy:check`, confirm exit `0` and `"Policy check passed — no rules registered"`, then restore the dummy rule
- [x] T008 Verify error-severity rule causes exit `1` — temporarily add a rule returning `{ success: false, severity: "error" }` to `scripts/policy-engine/registry.ts`, run `bun run policy:check`, confirm exit `1` and `"Policy check failed"` on stderr, then restore registry to dummy-only state
- [x] T009 Verify LOC constraint — run `wc -l scripts/policy-engine/types.ts scripts/policy-engine/registry.ts scripts/policy-engine/runner.ts` and confirm total ≤ 200 lines

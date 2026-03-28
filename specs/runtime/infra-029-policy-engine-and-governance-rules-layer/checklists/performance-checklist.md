# Performance Checklist: Policy Engine and Governance Rules Layer

**Purpose**: Validates that performance requirements in this spec are quantified, consistent, complete, and sufficient to guide implementation and acceptance testing before any code is written.
**Created**: 2026-03-25
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-29

---

## Timing Budget Requirements

- [ ] CHK001 — Is the `<2s` budget for `--changed` mode (NFR-001) defined with a measurable baseline — i.e., is "typical commit (1–15 changed files)" the only defined scope, or are degenerate cases (e.g., 15 changed files that each affect 100 rules) covered? [Clarity, Spec §NFR-001]

  > The requirement says "typical commit (1–15 changed files)" but does not define the worst-case budget for the upper bound of that range.

- [ ] CHK002 — Is the "under 60 seconds" budget for `--full` mode expressed as SHOULD (target) vs. MUST (hard gate)? The spec uses SHOULD — is this intentional and documented as non-blocking for stage closure? [Clarity, Spec §NFR-002]

  > NFR-001 uses MUST; NFR-002 uses SHOULD. This asymmetry must be documented as an explicit design decision, not an oversight.

- [ ] CHK003 — Are the performance budgets (2s, 60s) tied to a defined hardware baseline — is "standard developer machine" and "M-series" sufficiently specific for CI environments (where hardware may differ)? [Clarity, Gap — Spec §NFR-001, §Assumptions]

  > The Assumptions section mentions "Apple M-series or equivalent developer machine with warm file-system cache". Is "warm cache" a precondition for the SLA? CI runners may have cold caches.

- [ ] CHK004 — Is there a requirement that the performance baseline is measured with all four adapters active — not just the engine core with zero adapters registered? [Completeness, Gap]

  > A sub-2s budget with zero adapters is trivial; the meaningful test is with all registered adapters. The spec does not define the measurement baseline.

- [ ] CHK005 — Is it specified how the `<2s` pre-commit budget is measured — wall-clock time, CPU time, or time-to-first-result? [Clarity, Gap — Spec §NFR-001]

---

## Per-Rule Timeout Requirements

- [ ] CHK006 — Are the per-engine timeout thresholds (2,000ms for `--changed`, 30,000ms for `--full`) defined at the engine level or per-rule level? The spec says "per invocation" (NFR-021) — does this mean all rules combined must complete within the budget, or each individual rule? [Clarity, Spec §NFR-021]

  > "Per invocation" is ambiguous. If it's per-engine-run, a single slow rule consuming 1,999ms leaves zero budget for remaining rules in `--changed` mode.

- [ ] CHK007 — Is there a requirement for an individual rule-level timeout in addition to the engine-level invocation timeout? Without per-rule timeouts, one runaway rule in `Promise.all` could exhaust the entire engine budget. [Gap, Spec §NFR-021]

- [ ] CHK008 — Are requirements defined for what partial results are returned when the engine times out (NFR-021) — are results from rules that completed before the timeout surfaced, or is the entire result set discarded? [Completeness, Spec §NFR-021]

  > NFR-021 says the engine "aborts remaining rule evaluation" and emits `ENGINE-TIMEOUT`. It does not specify whether already-completed rule results are included in the output alongside the timeout result.

- [ ] CHK009 — Is the timeout for sequential rules (those declaring `sequential: true` via FR-011) defined separately from parallel rules? Sequential rules run after `Promise.all` completes — does the timeout countdown continue through the sequential phase? [Gap, Spec §FR-011, §NFR-021]

---

## Parallel Rule Execution (Promise.all)

- [ ] CHK010 — Is the requirement that rules are parallelizable "by default" (NFR-003) reconciled with the security requirement that rules must be pure with respect to external I/O (NFR-019)? Is purity a stated precondition for parallel eligibility? [Consistency, Spec §NFR-003, §NFR-019]

  > If purity is not enforced structurally, a rule that violates NFR-019 (e.g., mutates a shared file) could produce non-deterministic results when run in parallel. The spec doesn't connect these two requirements.

- [ ] CHK011 — Are requirements defined for the maximum number of rules that can safely run in parallel — is there a cap to prevent resource exhaustion (e.g., 100+ rules all spawning subprocesses concurrently)? [Gap]

  > If every registered rule spawns an adapter subprocess, and all run in `Promise.all`, the number of concurrent child processes is unbounded. No concurrency limit is stated.

- [ ] CHK012 — Is the `Promise.all` parallelization requirement specific about which phase it covers — does it apply to rule `evaluate()` calls only, or also to context loading (FR-013 through FR-017) and reporting? [Clarity, Spec §NFR-003]

- [ ] CHK013 — Are requirements defined for the ordering of `sequential: true` rules relative to each other — is execution order among sequential rules deterministic and specified? [Completeness, Spec §FR-011]
  > The spec says sequential rules "run after all parallel rules complete" but does not specify whether they run in registration order, alphabetical order, or an unspecified order.

---

## Rule Registry Startup Performance

- [ ] CHK014 — Is there a requirement that the rule registry module does not import heavy dependencies at the top level? "Heavy modules" is undefined — what qualifies? (e.g., TypeScript compiler, Trivy binary, GitNexus full graph?) [Clarity, Gap]

  > The user's request identifies this as a concern, but the spec does not define what constitutes a "heavy module" or set a startup budget.

- [ ] CHK015 — Is there a startup-time budget defined for the engine's initialization phase (context loading + registry initialization + rule registration) separate from the rule execution budget? [Gap, Spec §NFR-001, §NFR-002]

  > If the 2s budget includes startup, this constrains module initialization. If it excludes startup, that must be stated.

- [ ] CHK016 — Are requirements defined that adapters use lazy initialization (i.e., they do not spawn their subprocess until `evaluate()` is called, not at module import time)? [Gap]

  > If an adapter spawns a subprocess during `import`, the engine startup time is unbounded and the parallel execution model breaks.

- [ ] CHK017 — Is the rule that the registry is populated at "module initialization time" (Architecture Constraints §8) reconciled with startup performance? Does compile-time registration mean all rule modules are imported on startup, even if none of their rules are in scope for the current run? [Consistency, Spec §Architecture Constraints §8]

---

## Adapter Subprocess Async Spawning

- [ ] CHK018 — Is the requirement that adapter subprocesses are spawned asynchronously (non-blocking) explicitly stated in the spec, or is it only implied by the `Promise.all` parallel execution model? [Completeness, Gap]

  > The spec's security section and NFR-003 together imply async spawning, but no requirement explicitly states that synchronous subprocess blocking is forbidden.

- [ ] CHK019 — Are requirements defined for how subprocess output buffering affects performance — i.e., if a legacy tool writes a large stdout, does the adapter buffer it all in memory before parsing, or stream it? [Gap]

  > Buffering large subprocess outputs (e.g., Trivy JSON on a large dependency tree) inline before parsing can introduce latency and memory pressure that is not accounted for in the timing budget.

- [ ] CHK020 — Is there a requirement that adapter subprocesses are killed or cleaned up when the engine timeout fires (NFR-021)? Orphaned processes consuming resources after timeout could affect subsequent runs. [Gap, Spec §NFR-021]

- [ ] CHK021 — Are performance requirements defined for the adapter subprocess startup overhead — if `arch:guard` takes 3 seconds to initialize before producing output, does this alone violate the `--changed` 2s budget? [Coverage, Spec §NFR-001]
  > The spec requires <2s for `--changed` but the legacy tool invoked by an adapter may inherently take longer. Is there a requirement that adapters be profiled against the budget?

---

## Changed-Mode Rule Scoping (NFR-004)

- [ ] CHK022 — Is the requirement that rules scope their evaluation to `changedFiles` in `--changed` mode (NFR-004) defined at the rule interface level — i.e., is there a structural contract that prevents a rule from ignoring `changedFiles` and scanning the full repo? [Clarity, Spec §NFR-004]

  > NFR-004 is a behavioral requirement on rule authors. Without interface-level enforcement, a rule can silently bypass it and blow the 2s budget.

- [ ] CHK023 — Are requirements defined for how rules determine which files are "applicable" to a given changed file set — is there specification of the mapping logic (e.g., a changed `.ts` file triggers type-safety rules but not the naming convention rule)? [Completeness, Gap]

  > Without applicability mapping, every rule runs against every changed file, which may still violate the 2s budget for rules with expensive evaluation.

- [ ] CHK024 — Are the performance requirements in NFR-001 through NFR-004 traceable to acceptance scenarios — is there a User Story (or Success Criterion) that explicitly validates the timing SLA under realistic conditions? [Traceability, Spec §SC-002]
  > SC-002 covers the 2s SLA. Does it reference the correct NFRs, and is the verification method (benchmark test, profiler output, wall-clock measurement) specified?

---

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is missing and must be added
- `[Clarity]` = requirement present but ambiguous or unmeasurable
- `[Consistency]` = two requirements may conflict
- Items reference FR/NFR codes from spec where applicable

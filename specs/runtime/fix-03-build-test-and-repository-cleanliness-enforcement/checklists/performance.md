# Performance Checklist: Build, Test, and Repository Cleanliness Enforcement

**Purpose**: Validate that performance requirements for the Policy Engine enforcement layer are complete, measurable, and free of ambiguity — covering execution time budgets, scope budgets, resource constraints, and degradation behavior.
**Created**: 2026-03-24
**Feature**: [spec.md](../spec.md)
**Scope**: Infrastructure / Policy Engine enforcement layer. No user-facing surfaces. Performance targets govern developer workflow latency and CI pipeline throughput.

---

## Execution Time Budget Completeness

- [ ] CHK001 - Is the 60-second budget in SC-001 defined as **wall-clock elapsed time** or as CPU time, and under what baseline machine specification (CPU cores, RAM, disk type)? [Clarity, Spec §SC-001]
- [ ] CHK002 - Is the GitNexus context generation time (`bun run arch:gitnexus:context`) explicitly **included or excluded** from the 60-second budget in SC-001 for `--changed` mode? [Clarity, Spec §SC-001, FR-004]
- [ ] CHK003 - Is the 10-minute budget in SC-002 defined as wall-clock elapsed time, and does it account for Docker container startup time (Postgres, Redis) if those are not pre-warmed? [Clarity, Spec §SC-002]
- [ ] CHK004 - Are time budgets for individual supporting scripts (`repo:assert-clean`, `repo:detect-artifacts`, `repo:hash-build`, `validate:runtime-env`) specified, so rule implementers know their allocated slice of the global budget? [Completeness, Gap]
- [ ] CHK005 - Is a time budget specified for the "no-op success" case in `--changed` mode with zero changed files — e.g., must exit within under N seconds? [Completeness, Spec §Edge Cases]

---

## Scope Budget & Module Filtering (--changed Mode)

- [ ] CHK006 - Is the requirement that `--changed` mode uses GitNexus to limit execution to impacted modules (FR-004) specified with a cap on the **maximum number of modules** that can be selected before the mode degrades to `--full` behavior? [Completeness, Spec §FR-004]
- [ ] CHK007 - Is the performance impact of GitNexus context being **stale or absent** specified — does the rule fail fast, regenerate context (with a time cost), or fall back to full-workspace execution? [Coverage, Gap]
- [ ] CHK008 - Is it specified whether `--changed` mode's 60-second budget scales linearly with the number of changed files, or is it a fixed cap regardless of change count? [Clarity, Spec §SC-001]

---

## Test Isolation & Initialization Overhead

- [ ] CHK009 - Are the test isolation scripts (`init-test-db.sh`, `reset-test-redis.sh` — FR-012) specified with execution time budgets that fit within both SC-001 and SC-002 without being the bottleneck? [Completeness, Gap]
- [ ] CHK010 - Is the performance impact of serial test execution per module (`--pool=forks --isolate` — NFC-009) versus parallel execution specified with any tradeoff rationale or timing expectation? [Completeness, Spec §NFC-009]
- [ ] CHK011 - Are requirements defined for the time cost of spawning Vitest `--pool=forks` processes per module, particularly when the module count is high in `--full` mode? [Coverage, Gap]

---

## Coverage Reporting Overhead

- [ ] CHK012 - Is SC-007's requirement that coverage thresholds are "reported on every `--full` run" specified with a constraint that coverage collection **does not materially extend** the 10-minute SC-002 budget? [Completeness, Spec §SC-007]
- [ ] CHK013 - Is the performance behavior defined for the case where a module has no prior coverage data — does coverage reporting add measurable overhead in this first-run scenario? [Coverage, Gap]

---

## Idempotency & Repeated Invocation Cost

- [ ] CHK014 - Is idempotency in NFC-006 specified with a performance constraint — specifically, that repeated invocations of `repo:assert-clean`, `repo:snapshot`, and `repo:detect-artifacts` do **not accumulate state or grow in runtime** with each call? [Clarity, Spec §NFC-006]
- [ ] CHK015 - Is the performance behavior of `ArtifactSnapshot` diff computation specified for repositories with large numbers of untracked files (e.g., after a large codegen run)? [Coverage, Gap]

---

## Policy Engine Startup & Rule Execution Overhead

- [ ] CHK016 - Are performance requirements defined for the **startup and initialization time** of the policy engine module (INFRA-29) itself, separate from individual rule execution times? [Completeness, Gap]
- [ ] CHK017 - Is the sequential rule execution order (FR-003, 8+ rules) specified with a requirement that early-failing rules (e.g., `RULE_FIX_03_ENVIRONMENT_READY`) **short-circuit** the remaining pipeline to avoid wasted time? [Completeness, Spec §FR-003]
- [ ] CHK018 - Is "short-circuit on first `error`-severity failure" behavior specified as a requirement for `--changed` mode, or does the pipeline always execute all rules regardless of prior failures? [Clarity, Gap]

---

## CI Parallel Job Performance

- [ ] CHK019 - Are performance requirements defined for `--full` mode running while multiple parallel CI jobs share the same host — i.e., is there a resource isolation requirement to prevent job starvation? [Coverage, Spec §NFC-009]
- [ ] CHK020 - Is SC-003's requirement of "zero CI pipeline failures attributable to direct `build`/`test` invocations" specified with a detection mechanism that does not add measurable overhead to the CI run? [Measurability, Spec §SC-003]

---

## Success Criteria Measurability

- [ ] CHK021 - Can SC-001 (60s) and SC-002 (10min) be **objectively enforced** by a timing assertion within the policy engine itself, or are they aspirational targets with no automated gate? [Measurability, Spec §SC-001, SC-002]
- [ ] CHK022 - Is SC-008's requirement that all 14 rules are "invokable individually for debugging" specified with a performance expectation — e.g., individual rule invocation under N seconds? [Completeness, Spec §SC-008]

---

## Error & Exception Handling Performance

- [ ] CHK023 - Is the performance overhead of structured crash reporting for uncaught exceptions within a rule (Edge Case) bounded — i.e., a crashing rule must not cause the engine to hang indefinitely? [Edge Case, Spec §Edge Cases]
- [ ] CHK024 - Is the auto-fix revert scenario (Edge Case: auto-fix breaks typecheck) specified with a performance requirement bounding how long the revert + re-report cycle may take before the engine exits? [Edge Case, Spec §Edge Cases]

---

## Notes

- Success criteria SC-001 and SC-002 are the primary measurable performance gates. Items here test whether those requirements are written precisely enough to be testable.
- Items marked `[Gap]` indicate missing performance sub-requirements that, if left unspecified, risk silent scope creep during implementation.
- Infrastructure-tier performance (no user-facing latency, no SLA for end users) — focus is developer workflow and CI throughput.

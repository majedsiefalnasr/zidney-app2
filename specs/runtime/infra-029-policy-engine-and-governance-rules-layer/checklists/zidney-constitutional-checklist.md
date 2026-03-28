# Zidney Constitutional Checklist: Policy Engine and Governance Rules Layer

**Purpose**: Validates that this spec conforms to Zidney platform-wide constitutional rules — import boundaries, multi-tenancy isolation, error contracts, logging standards, and the Zidney architectural invariants — before implementation begins.
**Created**: 2026-03-25
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-29

---

## Import Boundary Compliance

- [ ] CHK001 — Are the permitted import paths for `scripts/policy-engine/` explicitly enumerated in the spec — not just described by the prohibition ("no `apps/*`") but also by the allowlist (which `packages/*` are explicitly permitted)? [Completeness, Spec §Architecture Constraints §3]

  > The spec permits `packages/*` "for shared types only" but does not list which packages are allowed. Is `packages/domain-core` permitted? `packages/logger`? Without an allowlist, "shared types only" is unenforceable.

- [ ] CHK002 — Is there a requirement that `scripts/policy-engine/` does not import from other `scripts/` subdirectories that themselves import from `apps/*`? Transitive import violations are not addressed. [Gap]

  > The import boundary check at the top level does not cover transitive violations. If `scripts/utils/x.ts` imports from `apps/api`, and `scripts/policy-engine/y.ts` imports `scripts/utils/x.ts`, the boundary is broken transitively.

- [ ] CHK003 — Is the requirement that `packages/*` cannot import from `apps/*` (platform-wide rule) referenced in the spec's architecture constraints — or is it only enforced by the existing `arch:guard` without explicit restatement here? [Traceability, Spec §Architecture Constraints]

  > The platform constitutional rule (packages → apps is forbidden) should be cited as the governing ADR or AGENTS.md rule rather than only stated as an incidental constraint.

- [ ] CHK004 — Are requirements defined that the policy engine will itself detect and report its own import boundary violations (i.e., if someone adds an `apps/*` import to `scripts/policy-engine/`, the ARCH domain rule will catch it)? [Coverage, Gap]
  > Self-referential enforcement is implied but not stated. Without it, the engine could develop violations that go unreported.

---

## No Direct DB Instantiation in Policy Engine

- [ ] CHK005 — Is the prohibition on direct database instantiation in the policy engine explicitly stated in the spec, or only implied by the statement "no domain business logic" in Architecture Constraints §5? [Completeness, Gap]

  > The spec says the engine evaluates "structural and governance rules only" and has no business logic. But the prohibition on DB access is not stated as an explicit requirement. A reader could incorrectly assume a DB query in a rule is acceptable if it serves governance.

- [ ] CHK006 — Is there a requirement that the `PolicyContext` object does not include any DB-sourced data (which would imply a live DB connection somewhere in the context loading chain)? [Gap]

  > `PolicyContext` fields (`changedFiles`, `dependencyGraph`, `gitHistory`, `scripts`, `vulnerabilities`) are all file/git-sourced. Is this constraint on context data sources explicit in the spec?

- [ ] CHK007 — Is the "N/A — no DB in this stage" qualification (mentioned by the user for migration discipline) formally documented as an explicit out-of-scope declaration in the spec, or is it implicit? [Traceability, Spec §Out of Scope]
  > The Out of Scope section does not explicitly call out "no database migrations" as a deliberate decision. This could cause confusion during stage closure review.

---

## All Enforcement Logic Centralized in Registered Rules

- [ ] CHK008 — Is the requirement that "no enforcement logic lives outside of registered policy rules" (Overview section) traceable to a specific FR that will be validated during stage closure gate 4? [Traceability, Spec §FR-009, §Gate 4]

  > FR-009 states "every active governance rule MUST be registered in the engine registry" and Gate 4 requires zero direct governance calls in the orchestrator. Together these cover the centralization requirement — but is this connection explicit enough for a reviewer?

- [ ] CHK009 — Are requirements defined for what constitutes "enforcement logic" vs. "utility code" — could a helper function in `scripts/utils/` that validates a naming convention be considered undeclared enforcement logic? [Clarity, Gap]

  > Without a definition of "enforcement logic", the boundary between a registered rule and a utility function that happens to enforce something is ambiguous.

- [ ] CHK010 — Is the requirement that CI YAML files must not invoke legacy guard scripts (FR-036) defined with a discovery method — i.e., how will the policy engine detect violations of FR-036 in CI YAML? Is there a registered rule for this? [Coverage, Spec §FR-036]

  > FR-036 is a requirement that existing CI YAML must be migrated. But without a `PolicyRule` that scans CI YAML for direct legacy script invocations, this constraint has no automated enforcement.

- [ ] CHK011 — Are requirements defined for the transition period: while adapters are being built, legacy tools may still be invoked directly. Is there specification for when FR-009 (no unregistered enforcement) goes into full effect — immediately or at stage closure? [Gap, Spec §FR-009]

---

## Forward-Only Migration Discipline (N/A Declaration)

- [ ] CHK012 — Is the absence of database migrations explicitly documented as an intentional architectural decision for this stage, not an oversight? [Traceability, Spec §Out of Scope]

  > The spec's Out of Scope section does not include this. Adding it would make stage closure review unambiguous.

- [ ] CHK013 — If future stages of the policy engine add a persistent rule registry store (e.g., SQLite or Postgres), are the migration governance rules that would apply documented anywhere as a forward-looking constraint? [Gap]
  > This stage creates a compile-time registry with no persistence. If persistence is added later, migration governance applies. Should the spec declare the current architecture as "no persistence required" to make future migrations traceable?

---

## License Middleware Compliance (N/A Declaration)

- [ ] CHK014 — Is the fact that the policy engine operates at the scripts/CI layer (not behind any HTTP route requiring license validation) explicitly documented, making the license middleware N/A status clearly intentional rather than overlooked? [Traceability, Gap]
  > Similar to migration discipline, the Out of Scope section does not explicitly state "no license middleware required — scripts layer only."

---

## Structured Logging with Correlation ID

- [ ] CHK015 — Are requirements defined for whether the policy engine uses the `packages/logger` structured logging package, or outputs directly to stdout via `console.log`? [Completeness, Gap]

  > The spec does not mention the `packages/logger` package anywhere. For platform-wide observability, is structured logging required for engine operations, rule evaluation events, and errors?

- [ ] CHK016 — If `packages/logger` is used, are requirements defined for correlation ID propagation — e.g., when the orchestrator calls `policyEngine.check(context)`, does the engine inherit a parent correlation ID? [Gap]

  > The Zidney observability standard requires correlation ID propagation through all services. The spec does not define how the policy engine participates in this chain.

- [ ] CHK017 — Are logging requirements defined at the rule level — specifically, must a rule that throws an exception log structured diagnostic information, or is the error result emission (FR-007) the only required output? [Clarity, Spec §FR-007]

  > FR-007 specifies emitting an error result for failed rules but says nothing about structured log emission for diagnostics. Are structured logs required alongside the result?

- [ ] CHK018 — Are requirements defined for the log verbosity level of the policy engine — DEBUG, INFO, WARN, ERROR — and how these correlate to `--changed` vs `--full` mode? [Gap]
  > A CI run may require quieter output than a local dev run. Without log level requirements, the engine's logging behavior is undefined.

---

## Error Contract: PolicyResult Shape

- [ ] CHK019 — Is the `PolicyResult` TypeScript type definition (with all required and optional fields) specified precisely enough to be a contract — specifically: are `ruleId`, `severity`, `message` required, and are `file` and `suggestion` optional? [Completeness, Spec §Key Entities]

  > The spec describes these fields in prose ("Contains `ruleId`, `severity`, `message`, and optional `file` and `suggestion`") but does not provide the TypeScript type definition. Is this intentional — is the type definition left to implementation?

- [ ] CHK020 — Is the `severity` field in `PolicyResult` defined as a closed union (e.g., `'error' | 'warning' | 'info'`) in the spec, or is it left open? If open, a rule could return an unrecognized severity and the engine might handle it incorrectly. [Clarity, Spec §Key Entities, §FR-004, §FR-005]

  > FR-004 references "error"-severity and FR-005 references "warning"-only results. Are these the only two valid severities, or is "info" also valid? The spec uses "warning" in FR-003 fallback results but this is not in the FR-004/FR-005 exit code logic.

- [ ] CHK021 — Is the `ruleId` field in `PolicyResult` required to match a registered rule's `id` — i.e., can an adapter emit a `PolicyResult` with an arbitrary `ruleId` that was never registered? [Gap, Spec §Key Entities]

  > If adapters can emit `PolicyResult` with unregistered `ruleId` values (e.g., dynamically derived from CVE IDs), the rule ID uniqueness guarantee (FR-012) is bypassed.

- [ ] CHK022 — Is the `ENGINE-TIMEOUT` `ruleId` used in NFR-021 consistent with the `<DOMAIN>-<NNN>` naming convention required by NFR-016? [Consistency, Spec §NFR-016, §NFR-021]

  > NFR-016 requires IDs like `ARCH-001`, `SCRIPTS-003`. But NFR-021 specifies `ruleId: 'ENGINE-TIMEOUT'` — which does not match this pattern. Is `ENGINE-*` a permitted system-reserved namespace?

- [ ] CHK023 — Are requirements defined for what a reporter should do when it receives a `PolicyResult` with missing required fields — i.e., is there an input validation contract for the reporter layer? [Gap]
  > If `message` is undefined or `ruleId` is empty, the console and JSON reporters may output malformed or confusing output. No validation requirement is specified.

---

## Platform-Wide Architectural Invariants

- [ ] CHK024 — Is the "no business logic in the policy engine" constraint (Architecture Constraints §5) defined with examples specific to the Zidney domain — e.g., "no tenant isolation checks, no exam scoring rules, no license validation" — so implementers can make unambiguous decisions? [Clarity, Spec §Architecture Constraints §5]

  > "Domain business logic" is a platform concept, but without concrete examples specific to Zidney, a developer adding a "rule that checks tenant count" might not recognize it as a business rule.

- [ ] CHK025 — Is the Bun-runtime constraint (Architecture Constraints §6) cross-referenced to a platform-wide ADR or documented baseline, or is it only stated here without traceability to the platform invariant? [Traceability, Spec §Architecture Constraints §6]

  > Platform-wide Bun requirements should reference the authoritative Zidney baseline document (e.g., `AGENTS.md` or an ADR) rather than only appearing in feature-level constraints.

- [ ] CHK026 — Are requirements defined for how the policy engine integrates with the existing `bun run arch:guard` and `bun run type-safety-guard` scripts in CI during the adapter migration period — specifically, is there a spec for the "both old and new run simultaneously" transition window? [Gap, Spec §Architecture Constraints §1]

  > AC §1 says legacy tools must not be removed. But if legacy tools and adapter equivalents both run in CI simultaneously, results may be duplicated. Is this acceptable during the transition, and for how long?

- [ ] CHK027 — Does the spec define the relationship between the policy engine and the existing `bun scripts/ai-guard.ts` script — is `ai-guard.ts` expected to be wrapped as an adapter, or is it in a separate governance domain? [Gap]

  > The `ai` domain is listed in FR-010 as a valid policy domain, and `ai-guard.ts` exists in the repo. The spec does not explicitly call out whether this tool becomes an adapter or remains standalone.

- [ ] CHK028 — Is the `TypeScript strict mode` requirement (Architecture Constraints §4) specified with a reference to the shared `tsconfig.base.json` or the engine-specific tsconfig, to prevent implementers from applying a custom `strict: false` override? [Clarity, Spec §Architecture Constraints §4]

---

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is absent and must be explicitly added or declared N/A
- `[Clarity]` = requirement exists but is ambiguous or lacks measurable criteria
- `[Consistency]` = potential contradiction between two requirements or conventions
- `[Traceability]` = requirement is present but not linked to the governing authority
- Items reference FR/NFR codes from spec where applicable

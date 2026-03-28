# Security Checklist: Policy Engine and Governance Rules Layer

**Purpose**: Validates that security requirements in this spec are complete, clear, unambiguous, and cover all relevant threat surfaces before implementation begins.
**Created**: 2026-03-25
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-29

---

## Shell Injection Prevention

- [ ] CHK001 — Is the prohibition on shell command execution from rule definitions explicitly stated and scoped to rule `evaluate()` functions only — not to adapter subprocess calls? [Clarity, Spec §NFR-017]

  > The spec says rules must not spawn shell commands, but adapters do spawn subprocesses. Are the two surfaces clearly separated in the requirement language?

- [ ] CHK002 — Are the "controlled argument shapes" for adapter subprocess invocations defined or referenced? Does the spec specify what sanitization or allowlisting applies to subprocess arguments before spawning? [Completeness, Gap — Spec §Security Considerations]

  > The spec says adapters call legacy tools "via controlled process calls with fixed argument shapes — not interpolated user data", but the exact argument-shape contract is not defined.

- [ ] CHK003 — Are requirements defined for how adapter subprocess arguments are constructed — specifically, is it specified that no part of `PolicyContext` data flows unescaped into subprocess argv? [Gap]

  > `PolicyContext` contains `changedFiles` (file paths). If a rule adapter passes these to a subprocess, the injection surface exists. The spec does not prescribe escaping or allow-listing rules.

- [ ] CHK004 — Is the requirement that adapter spawning is async and non-blocking (NFR-003 area) explicitly separated from the shell-injection prevention requirement so they are not conflated during implementation? [Clarity]
  > Async subprocess launch and safe argument construction are orthogonal concerns. The spec blends both in the security section.

---

## External Data Transmission (Trivy Adapter Isolation)

- [ ] CHK005 — Is the "local only" constraint for Trivy output processing defined with sufficient precision to be testable? Does the spec identify what "outside the local process" means in terms of observable behavior? [Clarity, Spec §NFR-018]

  > NFR-018 says data is never transmitted outside the local process, but the acceptance criteria don't include a testable network-isolation assertion.

- [ ] CHK006 — Are requirements defined for what happens when the Trivy executable itself initiates a network call (e.g., to fetch updated CVE databases) — is this in scope for isolation or explicitly excluded? [Coverage, Gap]

  > The spec is silent on whether network calls initiated by the Trivy subprocess (not the adapter code) are in scope for this requirement.

- [ ] CHK007 — Is there a requirement that the Trivy adapter's `PolicyResult` output is bounded in size — i.e., that raw CVE report data is not forwarded verbatim as the `message` field? [Gap]
  > If a Trivy report contains sensitive package metadata or internal path information, embedding it in `PolicyResult.message` could expose it in CI logs or JSON output. No size/content boundary is defined.

---

## Rule Isolation (Failure Containment)

- [ ] CHK008 — Is the rule exception isolation requirement (FR-007) sufficient to prevent a crashing rule from exposing its intermediate state or partial `PolicyContext` data to other rules? [Clarity, Spec §FR-007]

  > FR-007 specifies that the engine catches exceptions and continues. It does not specify whether the exception is caught before or after the rule has mutated any shared mutable state (if any exists).

- [ ] CHK009 — Are requirements defined for rule memory isolation — specifically, can a rule that crashes mid-evaluation leave references in a shared heap accessible by subsequent rules? [Gap]

  > The spec implies rules are pure functions (NFR-019), but does not explicitly prohibit shared mutable closures within the registry. Is this enforced at the type level or only by convention?

- [ ] CHK010 — Is the guarantee that "rules are pure with respect to external I/O" (NFR-019) expressed in a way that is verifiable at review time, or is it purely a behavioral contract without structural enforcement? [Measurability, Spec §NFR-019]

  > Purity is not statically enforceable in TypeScript without additional tooling. The spec should clarify whether purity is a linting rule, a code review convention, or enforced via interface constraints.

- [ ] CHK011 — Are requirements defined that cover the case where a rule's `evaluate()` function is a legitimate long-running operation that correctly exits but produces an unexpectedly large result array — could this cause memory pressure that affects sibling rules in `Promise.all`? [Edge Case, Gap]

---

## Import Boundary: No `apps/*` From `scripts/policy-engine/`

- [ ] CHK012 — Is the import boundary prohibition on `apps/*` imports from `scripts/policy-engine/` stated as an active enforcement rule in the engine's own registry (not only as an architecture constraint in this spec document)? [Completeness, Spec §Architecture Constraints §3]

  > The spec lists this as a constraint but does not specify whether it is enforced by a registered `PolicyRule` (which would make it self-enforcing) or only by the architecture guard adapter.

- [ ] CHK013 — Does the spec define whether `scripts/policy-engine/` may import from `packages/types` for `PolicyRule`/`PolicyResult` type definitions, and if so, is the scope of permitted `packages/*` imports bounded? [Clarity, Spec §Architecture Constraints §3]

  > The spec says "It may import from `packages/*` for shared types only" but does not define which packages are permitted and which are off-limits (e.g., is `packages/domain-core` forbidden?).

- [ ] CHK014 — Is there a requirement that the import boundary violation rule is itself subject to the policy engine (i.e., it will catch violations in `scripts/policy-engine/` itself)? [Coverage, Gap]
  > Self-referential enforcement: does the engine detect its own import violations?

---

## No Secrets in Policy Output (FR-040)

- [ ] CHK015 — FR-040 as cited in the request does not match the FR numbering in the spec (FR-040 is "No redundant validation logic MUST remain in Husky hooks"). Is the "no secrets in context" requirement correctly identified and traceable to the right requirement identifier? [Consistency, Conflict]

  > The "no secrets in `PolicyContext`" requirement is in the Security Considerations section without a formal FR number. This gap means it cannot be traced in the registry or validated by a named rule.

- [ ] CHK016 — Is the requirement that `PolicyContext` MUST NOT include secrets defined with a testable boundary — i.e., what types of values constitute "secrets"? (tokens, private keys, connection strings, all env vars?) [Clarity, Spec §Security Considerations]

  > Without a definition of "secret", implementers cannot write a deterministic validation rule.

- [ ] CHK017 — Are requirements defined for what the context loader does when it detects a secret in the environment — "they MUST not propagate them into the context" — but is there a requirement to emit a warning or error result when this interception occurs? [Gap, Spec §Security Considerations]

  > The spec says secrets must not propagate but does not say whether silent suppression or an explicit warning result is required.

- [ ] CHK018 — Is there a requirement that the JSON reporter (`--reporter=json`) output be scanned or filtered before stdout emission to ensure no secret values from the environment appear in serialized `PolicyResult` messages? [Gap]
  > If a rule's `message` field is constructed from data that transitively includes environment variables (e.g., a broken file path containing a home directory token), it could leak into JSON output.

---

## Rate Limiting / Abuse Prevention (External Trigger Surface)

- [ ] CHK019 — Is the trigger surface for the policy engine defined — specifically, are requirements established for whether the engine can be invoked via a web hook, HTTP endpoint, or any other externally-reachable path? [Coverage, Gap]

  > The spec says "No HTTP server" (Architecture Constraint §7), but does not address whether a CI webhook or GitHub Actions event can trigger unbounded parallel invocations. Is per-runner rate limiting a concern?

- [ ] CHK020 — Are requirements defined for concurrent invocation behavior — what happens when two `policy:check` processes run simultaneously on the same repository? Can they race on shared resources (e.g., GitNexus index file reads)? [Gap]

  > The spec does not address exclusive access to the GitNexus index or any file-system locking strategy during concurrent runs.

- [ ] CHK021 — Is the CLI's `--changed` mode trigger path (Husky pre-commit) analyzed for abuse vectors — e.g., can a crafted file name in a commit cause argument injection into the subprocess spawned by an adapter? [Gap, Spec §FR-037]
  > The spec requires `--changed` to scope by staged files but does not specify how staged file paths are passed to adapter subprocesses. A file named `; rm -rf /` is a canonical injection test case.

---

## PolicyResult Validation Before JSON Serialization

- [ ] CHK022 — Are requirements defined for validating `PolicyResult` objects before they are serialized to JSON — specifically, are there constraints on the `message`, `suggestion`, and `file` fields to prevent prototype pollution or JSON injection? [Gap]

  > If a rule's `message` contains `__proto__` or `constructor` keys embedded in a JSON string, and the serializer uses `JSON.parse` internally, prototype pollution is possible.

- [ ] CHK023 — Is the `PolicyResult` schema defined with explicit field type constraints (e.g., `message: string`, `file: string | undefined`) such that a rule returning a non-conforming object would be caught at the TypeScript level before serialization? [Clarity, Spec §Key Entities]

  > The spec describes `PolicyResult` fields in prose but does not specify whether the type definition is strict enough to reject extra unknown fields.

- [ ] CHK024 — Is there a requirement that the JSON reporter uses a safe serialization path (e.g., `JSON.stringify` with no `replacer` that could cause recursion or prototype chain traversal)? [Gap]

  > No serialization safety requirement is stated for the JSON reporter, despite it being a public output surface.

- [ ] CHK025 — Are requirements defined for what happens when a rule's `evaluate()` function returns a non-`PolicyResult[]` value (e.g., throws a non-Error, returns `undefined`, or returns a result with a `null` message)? Is the engine required to validate the return value before accepting it? [Coverage, Spec §FR-007]
  > FR-007 covers exception isolation but does not cover the case where the function returns successfully but returns malformed output.

---

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is missing and must be added or decision must be documented
- `[Clarity]` = requirement exists but is ambiguous or unmeasurable
- `[Consistency]` = potential conflict between two requirements
- Items reference FR/NFR codes from spec where applicable

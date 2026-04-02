# Research: Auto Selection Engine (Stage 39)

Generated: 2026-04-02
Branch: spec/039-auto-selection-engine
Status: Complete

## R-01 Deterministic Selection Algorithm

Decision: Use a deterministic application-layer selection algorithm per criteria block: fetch eligible candidate IDs in stable ascending order, apply seeded Fisher-Yates shuffle, then slice required count.

Rationale:

- Meets reproducibility requirement from spec FR-008 and SC-003.
- Avoids database-level random ordering overhead at high volume.
- Produces stable audit replay behavior when seed and eligible pool are unchanged.

Alternatives considered:

- ORDER BY random() in SQL: rejected due to performance and non-deterministic scaling characteristics.
- Pre-shuffled cache tables: deferred as future optimization, out of Stage 39 scope.

## R-02 Seed Generation and Persistence Strategy

Decision: Generate one seed at attempt start in server runtime, persist it in immutable attempt snapshot payload, and include it in structured selection diagnostics.

Rationale:

- One seed per attempt is sufficient for deterministic replay and auditable chain of selection decisions.
- Keeps replay logic independent from transient runtime state.

Alternatives considered:

- Criteria-level independent seed values: rejected for unnecessary complexity.
- Client-supplied seed: rejected by authoritative runtime constraints.

## R-03 Overlap and Undersized Uniqueness Protection

Decision: Enforce overlap safety at configuration save/publish and re-check at runtime selection merge.

Rationale:

- Stage clarification requires blocking publish when overlap can undersize final unique set.
- Runtime re-check remains necessary because visibility/enablement can change eligible pools after configuration.

Alternatives considered:

- Runtime-only validation: rejected because it permits preventable production incidents.
- Strict disallow-any-overlap policy: rejected because controlled overlap can still be valid.

## R-04 Concurrency and Atomicity Model

Decision: Run attempt-start selection and persistence in one transaction with explicit concurrency guards and uniqueness constraints.

Rationale:

- Guarantees no partial attempt creation when any selection step fails.
- Protects against duplicate question assignment in same attempt under concurrent requests.

Alternatives considered:

- Multi-step eventual consistency flow: rejected due to fairness and integrity risks.
- Out-of-transaction selection with later insert: rejected because pool drift can invalidate fairness.

## R-05 Criteria Model Evolution

Decision: Extend criteria model to support either percentage or fixed_count per block plus additional optional filter dimensions required by Stage 39.

Rationale:

- Current criteria schema is percentage-only and does not fully satisfy Stage 39 functional requirements.
- Additive migration preserves backward compatibility and allows progressive adoption.

Alternatives considered:

- Keep percentage-only and derive fixed count externally: rejected because spec requires both count modes.
- New parallel table for fixed counts: rejected as unnecessary schema duplication.

## R-06 Diagnostics and Error Taxonomy

Decision: Introduce explicit selection-domain error codes and structured diagnostic events carrying correlation/workspace/exam/attempt context.

Rationale:

- Supports operations and auditability requirements (FR-011, FR-013).
- Improves incident triage and replay verification.

Alternatives considered:

- Generic validation errors only: rejected because root-cause clarity is insufficient.
- Logging full candidate payloads: rejected due to noise and sensitive-content risk.

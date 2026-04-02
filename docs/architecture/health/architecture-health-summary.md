# Architecture Health Summary

- Score: 91
- Health State: EXCELLENT
- Verdict: PASS
- Threshold: 80

## Findings

- **HIGH** apps/api: Relative architecture leak: "../../../packages/domain-core/src/attempts/auto-selection.service" should use module import instead of relative path
- **MEDIUM** gitnexus query: GitNexus query failed during architecture-health enrichment.
- **MEDIUM** gitnexus impact: GitNexus impact failed during architecture-health enrichment.

## Signals

- dependency_integrity: FAIL (1 findings, delta 5)
- layer_integrity: PASS (0 findings, delta 0)
- circular_dependency_risk: PASS (0 findings, delta 0)
- type_safety_governance: PASS (0 findings, delta 0)
- architecture_drift: WARN (2 findings, delta 4)
- intelligence_synchronization: PASS (0 findings, delta 0)

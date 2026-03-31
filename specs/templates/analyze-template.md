Zidney Strict Analyze Template (Architecture Drift Detector)

Before approving tasks for implementation, perform a full Architecture Governance compliance audit.

Validate against:

- `AGENTS.md` — platform rules and import boundaries
- `docs/architecture/ADR/` — binding architectural decisions (ADR-0001 through ADR-0009)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — architecture contract

If violations are detected → STOP and describe conflicts clearly.

---

## Scope Validation

Confirm: • Phase: • Stage: • Related Spec: • Related ADR (if any):

Verify: • No cross-phase leakage • No architecture redesign hidden inside tasks • No implicit
feature creep

---

## Isolation Audit — ADR-0001

Check: • No cross-tenant joins • No shared student tables • No direct DB instantiation • No service
bypassing tenant resolver • License middleware present on all workspace APIs

If any found → BLOCK.

---

## License Enforcement Audit

Verify: • License status validated before DB usage • Version compatibility checks included • 423 /
403 / 426 error handling defined • No route bypassing license middleware

---

## Transaction Safety Audit

For each write endpoint:

Confirm: • Transaction wrapper present • Concurrency guard included • Rollback defined • No
race-condition risk

If missing → BLOCK.

---

## Idempotency Audit

For any operation marked as idempotent in plan.md:

Verify: • Idempotency strategy defined • Unique constraints defined • Replay protection defined •
Tests included • Consistent with clarifications from this stage

If missing → BLOCK.

---

## Snapshot Integrity Audit — ADR-0002

If feature involves snapshot-based operations:

Verify: • Snapshot frozen at start • No mutations of snapshotted data • Worker-only calculation (if
applicable) • API does not override snapshotted state • (Per ADR-0002 if applicable)

If violated → BLOCK.

---

## Versioning & Migration Audit — ADR-0007, ADR-0008

Verify: • Migration file defined (forward-only, never modify existing) • schema_version bump defined • Product version compatibility
defined (ADR-0007) • Semantic versioning alignment (ADR-0008) • Incompatible requests return 426

---

## Observability Audit

Verify: • Structured logging (Pino format) • correlation_id propagation (or equivalent) •
workspace_slug logging (tenant context) • Domain-specific IDs (attempt_id, student_id, etc. if
applicable) • No console.log

---

## Security Audit

Verify: • RBAC enforced server-side • JWT workspace scope validated • Validation using shared
package • No frontend business logic

---

## Trust Chain Audit

Verify the implementation respects the Zidney trust chain order:

**Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

• Isolation: Tenant boundary preserved (database-per-tenant)
• License: Validation middleware enforced before workspace access
• Authentication: JWT scope validated, RBAC enforced server-side
• Attempt: Snapshot integrity preserved (if applicable)
• Runtime: Server-authoritative time only (ADR-0006)
• Frontoffice: No business logic, API consumption only

---

## Import Boundary Audit

Verify no import boundary violations:

| Import Direction            | Allowed      |
| --------------------------- | ------------ |
| `apps/*` → `packages/*`     | ✅ Allowed   |
| `packages/*` → `packages/*` | ✅ Allowed   |
| `apps/*` → other `apps/*`   | ❌ Forbidden |
| `packages/*` → `apps/*`     | ❌ Forbidden |
| UI → DB schemas             | ❌ Forbidden |

If any cross-app imports found → BLOCK.

---

## Architecture Guard Evidence

Run and document governance validation results:

```bash
bun scripts/infra-audit.ts    # Infrastructure audit
bun scripts/ai-guard.ts        # AI governance guard
bun run lint                   # Lint check
bun run typecheck              # Type check
bun run test                   # Run tests
```

All checks must pass for APPROVED verdict.

---

## Architectural Drift Summary

Output must contain: • Violations detected (if any) • Risk level: LOW / MEDIUM / HIGH / CRITICAL •
Approval status: APPROVED / BLOCKED

---

## Final Compliance Statement

Must conclude with:

"Architecture compliant with Zidney Architecture Governance (AGENTS.md + ADRs)"

OR

"Implementation blocked due to governance violations"

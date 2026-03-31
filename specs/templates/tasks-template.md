Zidney Strict Tasks Template (Architecture Governance Enforced)

Before generating tasks, validate against Zidney Architecture Governance:

- `AGENTS.md` — platform rules and import boundaries
- `docs/architecture/ADR/` — binding architectural decisions (ADR-0001 through ADR-0009)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — architecture contract

Confirm:

- Plan complied with Zidney Architecture Governance
- No architectural violations exist
- Stage scope is respected

If not compliant → STOP and explain conflict.

---

## Stage Context

Specify:

- Phase:
- Stage:
- Related Plan:
- Related Spec:
- Related ADR (if any):

Tasks must not extend beyond this stage.

---

## Trust Chain Verification

All tasks must respect the Zidney trust chain order:

**Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

Tasks that break this chain are forbidden.

---

## Import Boundary Compliance

Tasks must not introduce import boundary violations:

| Import Direction            | Allowed      |
| --------------------------- | ------------ |
| `apps/*` → `packages/*`     | ✅ Allowed   |
| `packages/*` → `packages/*` | ✅ Allowed   |
| `apps/*` → other `apps/*`   | ❌ Forbidden |
| `packages/*` → `apps/*`     | ❌ Forbidden |
| UI → DB schemas             | ❌ Forbidden |

---

## Task Dependency Ordering (DAG)

Tasks must be ordered by dependency. No task may start before its dependencies are complete.

Format:

```
Task-N [depends on: Task-X, Task-Y]
```

Infrastructure tasks → API tasks → Worker tasks → Frontend tasks → Observability tasks → Testing tasks

---

## Task Categorization (Mandatory Structure)

Tasks must be grouped into:

Infrastructure Tasks

- Migration files
- Schema updates
- Version bumping
- Config updates

API Tasks

- Route creation
- Middleware wiring
- Validation schema
- Transaction wrapping
- Error handling
- Rate limiting configuration

Worker Tasks (if applicable)

- Queue definition
- Idempotency enforcement
- Transaction handling
- Retry & DLQ setup
- Logging instrumentation

Frontend Tasks (if applicable)

- API consumption
- State management
- UI wiring (shadcn-vue + Tailwind v4)
- No business logic

Observability Tasks

- Structured logging
- Correlation ID propagation
- Metrics emission
- Error mapping

Testing Tasks

- Unit tests
- Integration tests
- Isolation tests
- Idempotency tests
- Concurrency tests (if runtime)
- Version mismatch tests

---

## Hard Enforcement Rules Per Task

Each task must:

- Reference specific file path
- State which layer it belongs to
- State whether transaction required
- State whether idempotency required
- State whether version enforcement required
- State whether license middleware required

No vague tasks allowed.

Example of correct task format:

- [API] Add POST /attempt/start route in apps/api/src/modules/attempt/start.ts
- Uses tenant resolver
- Requires license middleware
- Wrap in transaction
- Validates schema_version
- Emits structured log

---

## Transaction Tasks

For every write operation:

Tasks must explicitly include:

- Add transaction wrapper
- Add rollback handling
- Add concurrency guard (if applicable)

No write endpoint without transaction task.

---

## Idempotency Tasks

If feature includes any operation where duplicates must be detected and handled:

Tasks must include:

- Add idempotency key validation (or equivalent)
- Add unique constraint
- Add replay-safe logic
- Add duplicate submission test
- (Based on idempotency strategy in plan.md)

---

## Version Enforcement Tasks

If DB touched:

Tasks must include:

- Migration file creation (forward-only, never modify existing migrations)
- schema_version bump
- product_version compatibility check (ADR-0007)
- Semantic versioning alignment (ADR-0008)
- 426 response handling

---

## Observability Tasks

Tasks must include:

- request_id propagation
- workspace_slug logging
- attempt_id logging (if runtime)
- Structured log schema validation

No console.log allowed.

---

## Security Tasks

Tasks must confirm:

- RBAC middleware applied
- No frontend authority logic
- JWT workspace scope verified
- Input validated with shared validation package

---

## Failure Handling Tasks

Tasks must include:

- Explicit error mapping
- Dead-letter handling (if worker)
- Timeout handling
- Graceful 423 / 403 / 426 enforcement

---

## Architecture Guard Tasks

Every task set must include a governance validation task:

- [ ] Run `bun run ai:guard && bun run arch:audit && bun run lint && bun run typecheck && bun run test`
- [ ] Verify no architecture drift with `bun scripts/infra-audit.ts`
- [ ] Verify AI governance with `bun scripts/ai-guard.ts`

---

## Non-Goals Confirmation

Tasks must not:

- Introduce new architecture
- Bypass middleware
- Touch unrelated layers
- Modify unrelated stages

If needed → new Stage required.

---

## Completion Checklist

Before finishing tasks, verify:

- All write paths transactional (per plan.md)
- All operations marked idempotent in plan.md tested
- Isolation preserved (per spec.md) — ADR-0001
- Version enforcement active (if stage touches DB) — ADR-0007, ADR-0008
- Logging structured
- No business logic in restricted layers (per spec.md)
- No direct DB instantiation (tenant resolver only)
- Layer boundaries respected (import boundary table above)
- Trust chain preserved
- Architecture guard passed

---

## Final Compliance Statement

Tasks must end with:

"Task set compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — No violations detected."

If violation exists: Tasks must stop and describe issue.

Zidney Strict Implementation Gate (Architecture Governance Enforced)

This template prevents unsafe execution.

Before generating code, validate against Zidney Architecture Governance:

- `AGENTS.md` — platform rules and import boundaries
- `docs/architecture/ADR/` — binding architectural decisions (ADR-0001 through ADR-0009)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — architecture contract

Confirm:

- Analyze step passed
- No governance violations
- No unresolved ambiguities

If not → STOP.

---

## Execution Scope Confirmation

State clearly:

- Phase:
- Stage:
- Files allowed to change:
- Files forbidden to change:

No file outside stage scope may be modified.

---

## Trust Chain Enforcement

All implementation must respect the Zidney trust chain order:

**Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

- Isolation: Tenant resolver required for all tenant DB access (ADR-0001)
- License: License validation middleware on all workspace routes
- Authentication: JWT scope validated, RBAC enforced server-side
- Attempt: Snapshot frozen at start, worker-only grading (ADR-0002)
- Runtime: Server-authoritative time only (ADR-0006)
- Frontoffice: API consumption only, no business logic

---

## Import Boundary Enforcement

| Import Direction            | Allowed      |
| --------------------------- | ------------ |
| `apps/*` → `packages/*`     | ✅ Allowed   |
| `packages/*` → `packages/*` | ✅ Allowed   |
| `apps/*` → other `apps/*`   | ❌ Forbidden |
| `packages/*` → `apps/*`     | ❌ Forbidden |
| UI → DB schemas             | ❌ Forbidden |

---

## Implementation Constraints

Enforce:

- Use tenant resolver only
- No direct DB instantiation
- All writes transactional
- Idempotency implemented where required
- Version enforcement active
- Worker-only grading
- Server-authoritative time
- Structured logging

---

## Forbidden Actions

Implementation must refuse:

- Architecture redesign
- Cross-tenant data access
- Shared runtime state
- Global mutable singletons
- Business logic in frontend
- License bypass
- Snapshot mutation
- Removing middleware

If request implies any of above → STOP.

---

## Runtime Safety Guarantees

Implementation must guarantee:

- Isolation preserved
- License enforcement active
- Snapshot integrity preserved
- Concurrency guarded
- Idempotency enforced
- Error format standardized
- Logging structured
- No stack traces exposed

---

## Error Contract

All API responses must follow:

```json
{
  "success": boolean,
  "data": object | null,
  "error": { "code": string, "message": string } | null
}
```

---

## Code Generation Rules

Code must:

- Follow AGENTS.md contracts
- Follow lint rules
- Use validation package
- Use shared types package
- Respect layering boundaries (import boundary table above)
- Use shadcn-vue + Tailwind v4 in UI
- Never duplicate logic across layers

---

## Architecture Guard Validation

Before completing implementation, run governance validation:

```bash
bun run ai:guard && bun run arch:audit && bun run lint && bun run typecheck && bun run test
```

Individual checks:

```bash
bun scripts/infra-audit.ts    # Infrastructure audit
bun scripts/ai-guard.ts        # AI governance guard
bun run lint                   # Lint check
bun run typecheck              # Type check
bun run test                   # Run tests
```

All checks must pass before implementation is considered complete.

---

## Git Governance

- Branch naming: `<stage-dir-name>` (matches stage directory)
- Commits: Conventional commit format (`feat(scope):`, `fix(scope):`, `chore(scope):`)
- No `--no-verify` bypass
- No force pushes without explicit approval

---

## Post-Implementation Checklist

After code generation:

Confirm (per this stage's tasks.md):

- All routes wrapped in required middleware
- All writes transactional (per plan.md)
- Idempotency tests included (per plan.md)
- Version checks active (if applicable to stage)
- Structured logs present (Pino format)
- No console.log
- No TODO left
- Import boundaries respected
- Trust chain preserved
- Error contract followed
- Architecture guard passed (`bun scripts/infra-audit.ts && bun scripts/ai-guard.ts`)
- Lint passed (`bun run lint`)
- Type check passed (`bun run typecheck`)
- Tests passed (`bun run test`)

---

## Final Implementation Declaration

Must end with:

"Implementation compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — Safety guarantees preserved."

If unable to comply → STOP and explain.

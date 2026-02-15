# Code Review Checklist

All reviews must enforce Zidney architectural discipline, tenant isolation, and runtime integrity.

This checklist is mandatory for every pull request.

---

## Spec Alignment

- Stage reference provided?
- Implementation matches spec definition?
- No undocumented behavior introduced?
- Spec updated if logic changed?

PR without spec alignment must not be approved.

---

## Architecture & Layering

- Correct layer separation (apps vs packages)?
- No cross-app imports?
- No service instantiating DB directly?
- Tenant DB accessed only via resolver context?
- No global state introduced?
- No circular dependencies?

Violation of layering rules is a blocker.

---

## Tenant Isolation

- No cross-tenant data access?
- No shared tables introduced?
- No fallback default DB connection?
- workspace_slug never trusted from client input?
- Resolver context required for all tenant routes?

Isolation violation is a critical rejection.

---

## Security

- Authentication validated?
- Workspace claim verified?
- RBAC enforced at API level?
- Permission checks not delegated to frontend?
- Sensitive fields excluded from responses?
- Input validated using Zod (or equivalent)?
- Rate limiting considered (login, submit, public endpoints)?

Security regressions are not allowed.

---

## License & Limits

- License middleware respected?
- Student/staff limits enforced transactionally?
- No race condition in limit checks?
- Soft-lock and archived states handled?

License bypass is unacceptable.

---

## Runtime & Attempt Engine

If PR touches runtime:

- Snapshot model respected?
- Attempt immutable after submission?
- Idempotency preserved?
- No grading logic mutation post-submission?
- Server time used (no client-time trust)?
- Concurrency guards maintained?

Runtime integrity is critical for institutional trust.

---

## Migration & Versioning

If schema change included:

- New migration file created?
- No historical migration modified?
- schema_version bumped?
- Compatible with product_version?
- Snapshot required evaluated?
- Tested on realistic dataset?

Migration discipline is mandatory.

---

## Performance

- Heavy queries indexed?
- No N+1 queries?
- Pagination applied where needed?
- No unbounded data loading?
- No blocking synchronous loops?
- No long-running logic inside request thread?

Performance issues must be flagged before merge.

---

## Logging & Observability

- Structured logging used (no console.log)?
- Correlation ID propagated?
- workspace_slug logged?
- attempt_id logged if runtime-related?
- Errors follow error handling standard?

Observability must remain intact.

---

## Testing

- Unit tests added or updated?
- Integration tests updated?
- Edge cases covered?
- Snapshot tests updated (if grading related)?
- Regression risk assessed?

No PR may reduce coverage without justification.

---

## Code Quality

- Strict TypeScript compliance?
- No unused variables?
- No dead code?
- No commented-out legacy logic?
- Clear naming and readability?
- No duplication that can be abstracted?

---

## Final Gate

Before approval confirm:

- CI passing?
- No architectural rule violated?
- No security regression?
- No isolation breach?
- Definition of Done satisfied?

If any answer is uncertain, do not approve.

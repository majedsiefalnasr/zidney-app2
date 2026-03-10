# Definition of Done

This document defines the mandatory completion criteria for any feature, module, or system change in
Zidney.

No feature may be merged, deployed, or considered complete unless all conditions below are
satisfied.

---

## Specification

- A corresponding spec stage exists in `/specs`
- Scope is clearly defined
- Dependencies identified
- Edge cases documented
- Acceptance criteria defined
- No ambiguity remains in business rules

If implementation diverges from spec, the spec must be updated before merge.

---

## Architecture Compliance

- Respects monorepo boundaries
- No cross-app imports
- Uses resolver-based tenant isolation
- No direct DB access outside approved layers
- License middleware enforced where required
- No violation of isolation or version contracts

---

## Database & Migrations

- Required migrations written
- Migration reviewed
- Backward compatibility verified (if applicable)
- Tenant + master schema separation respected
- Schema version incremented where required
- Rollback strategy considered

No schema change without migration.

---

## API Contract

- Route defined in correct app (api / worker)
- Input validated using shared validation package
- Proper HTTP status codes returned
- Error format follows platform standard
- Idempotency considered where required
- Rate limiting applied where needed
- Authentication and RBAC enforced

No unvalidated input allowed.

---

## Security

- Permission checks enforced
- No sensitive data exposed
- No plain-text secrets
- Logs do not contain passwords or tokens
- Workspace isolation verified
- Soft-lock & license checks applied

Security review mandatory for auth-related changes.

---

## Observability

- Structured logging implemented
- request_id propagated
- workspace_slug included (when applicable)
- Error paths logged
- Critical paths measurable

No silent failures allowed.

---

## Testing

- Unit tests written
- Integration tests written (if applicable)
- Permission enforcement tested
- Failure cases tested
- Migration tested locally
- Concurrency tested if applicable
- No skipped tests

Load test required for:

- Attempt engine
- Scheduled exam logic
- High-frequency endpoints

---

## Frontend (If Applicable)

- Uses shadcn-vue components
- Tailwind v4 only
- No custom CSS outside theme tokens
- No direct API calls without typed client
- Loading, empty, and error states handled
- Permission-based UI visibility enforced
- Accessibility considered (keyboard + aria basics)

---

## Performance

- No N+1 queries
- Queries indexed where required
- No blocking CPU loops
- No unbounded memory usage
- Worker jobs idempotent

---

## Documentation

- Spec updated if behavior changed
- ADR written if architectural decision made
- Relevant docs updated
- AGENTS.md rules respected

---

## Code Review

- Reviewed by another engineer or validated via AI review checklist
- Lint passes
- TypeScript strict passes
- No unused code
- No console.log in production paths
- No debug artifacts

---

## Deployment Readiness

- Environment variables documented
- No hardcoded credentials
- Docker build passes
- Health checks pass
- CI pipeline passes (if configured)

---

## Explicit Non-Completion Conditions

A feature is NOT done if:

- It works only locally
- Tests are missing
- Permissions are assumed but not enforced
- Error handling incomplete
- Schema change applied without migration
- Logs missing in critical path
- Spec outdated

---

## Enforcement Rule

Pull request must explicitly confirm:

"I confirm this feature meets the Definition of Done."

Failure to meet any condition blocks merge.

This document is mandatory and non-negotiable.

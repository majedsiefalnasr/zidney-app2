# Pull Request Template

All pull requests must comply with Zidney engineering governance.

Do not submit incomplete or speculative PRs.

---

## Summary

Concise description of the change.

What problem does this solve?

---

## Phase / Stage Reference

Specify exact spec reference:

Phase:
Stage:
Spec file path:

PRs without spec reference will be rejected.

---

## Type of Change

- [ ] Feature
- [ ] Bug Fix
- [ ] Refactor (no behavior change)
- [ ] Performance Improvement
- [ ] Security Update
- [ ] Migration
- [ ] Infrastructure

---

## Migration Details (If Applicable)

- [ ] No migration required
- [ ] Migration included

If migration included:

- Migration file name:
- Schema version updated:
- Snapshot required: Yes / No
- Backward compatible: Yes / No

Confirm:

- [ ] No previously merged migration modified
- [ ] Migration tested on realistic dataset
- [ ] Migration idempotent

---

## Isolation Verification

Confirm:

- [ ] No cross-tenant data access
- [ ] No shared DB references
- [ ] No global DB connection introduced
- [ ] Tenant resolver context respected

---

## Security Review

- [ ] Authentication impact reviewed
- [ ] Authorization (RBAC) impact reviewed
- [ ] No sensitive data logged
- [ ] Input validation applied (Zod or equivalent)
- [ ] Rate limiting considered (if public endpoint)

If authentication or permission logic changed, describe clearly.

---

## Runtime Impact

Indicate if this affects:

- [ ] Attempt engine
- [ ] Submission flow
- [ ] Scheduling engine
- [ ] Grading logic
- [ ] Concurrency guards
- [ ] License enforcement

If yes, explain impact.

---

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Snapshot tests updated (if grading related)
- [ ] Load impact evaluated (if runtime change)

Describe test coverage briefly.

---

## Observability

- [ ] Structured logs added where required
- [ ] Correlation ID propagated
- [ ] Errors follow error handling standard

---

## Definition of Done

Confirm:

- [ ] Code passes lint and type check
- [ ] Tests pass locally
- [ ] No console.log left in code
- [ ] No architectural rule violated
- [ ] Spec updated if behavior changed

---

## Reviewer Notes

Anything specific reviewers must focus on.
